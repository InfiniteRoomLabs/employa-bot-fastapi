"""DB-backed applications coverage (sprint-04 3a, AC-03/AC-09).

Fidelity: createApplication -> getApplication round-trips a wire-valid
joined view (submittedSnapshotId None, resumeName fallback / real resume
name). Provenance (PIN-9): a store-only mock fixture (STRIPE) is not served
by the DB-backed getApplications default view; a DB-only row IS; a
RECOGNIZED mock searchId (BACKEND) still serves its mock pool even for a
real tenant. Tenancy: getApplications excludes other tenants; getApplication
on a cross-tenant/unknown id is a tenant-indistinguishable 404;
createApplication with another tenant's resumeId is the same 404 (and mints
no job/application). Archive (PIN-16): outcome-bucketed bucket membership +
live counts over directly-inserted rows. Drift: wire -> row -> wire.
"""

from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import models, schemas, store
from app.application_mapper import row_to_wire_application, wire_application_to_row
from app.job_mapper import wire_job_to_row
from app.resume_mapper import wire_resume_to_row
from tests.conftest import SeededUsers

B = "/api/v1"

# Seeded mock-only fixture (platform, applied) -- verbatim from
# tests/contract/helpers.STRIPE. Never a DB row; used to prove the
# DB-backed default view does not serve store-only fixtures (PIN-9).
STRIPE = "6df605b9-9094-4344-8113-ac8b3248f03e"


def _wire_job(company: str = "Probe Co") -> schemas.Job:
    return schemas.Job.model_validate(
        {
            "id": str(uuid.uuid4()),
            "company": company,
            "title": "Staff Engineer",
            "location": {"raw": "Remote - US"},
            "workMode": "remote",
            "employment": {
                "classification": "w2",
                "cadence": "salary",
                "commitment": "full-time",
            },
            "compensation": None,
            "source": {
                "board": "greenhouse",
                "channel": "url",
                "capturedAt": datetime.now(UTC).isoformat(),
            },
            "posted": datetime.now(UTC).isoformat(),
        }
    )


def _insert_job(db: Session, job: schemas.Job, user_id: uuid.UUID) -> None:
    db.add(wire_job_to_row(job, user_id=user_id))
    db.commit()


def _wire_resume(name: str = "Distributed-systems") -> schemas.Resume:
    return schemas.Resume.model_validate(
        {
            "id": str(uuid.uuid4()),
            "name": name,
            "subtitle": "For Staff / Principal IC roles",
            "version": "v4",
            "usedIn": 0,
            "updated": datetime.now(UTC).isoformat(),
            "tag": "VARIANT",
            "match": None,
            "body": "Body copy.",
            "sourceUploadId": None,
            "templateId": None,
            "targetRole": None,
            "scoringEnabled": None,
        }
    )


def _create_body(
    *,
    company: str = "Acme",
    resume_id: uuid.UUID | None = None,
    search_id: uuid.UUID | None = None,
) -> dict:
    body: dict = {
        "company": company,
        "role": "Staff Engineer",
        "location": "Remote - US",
        "salary": {"min": 200000, "max": 250000, "extra": []},
        "match": 77,
        "source": "greenhouse",
    }
    if resume_id is not None:
        body["resumeId"] = str(resume_id)
    if search_id is not None:
        body["searchId"] = str(search_id)
    return body


def _insert_application(
    db: Session,
    *,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    resume_id: uuid.UUID | None = None,
    stage: str = "applied",
    version: int = 1,
    outcome: str | None = None,
) -> models.Application:
    row = models.Application(
        id=uuid.uuid4(),
        user_id=user_id,
        job_id=job_id,
        resume_id=resume_id,
        stage=stage,
        version=version,
        outcome=outcome,
    )
    db.add(row)
    db.commit()
    return row


# ------------------------------------------------------------- fidelity


def test_create_then_get_application_fidelity(db_client: TestClient) -> None:
    resp = db_client.post(f"{B}/applications", json=_create_body(company="Acme"))
    assert resp.status_code == 201, resp.text
    created = resp.json()
    schemas.ApplicationView.model_validate(created)
    assert created["company"] == "Acme"
    assert created["role"] == "Staff Engineer"
    assert created["location"] == "Remote - US"
    assert created["stage"] == "drafting"
    assert created["version"] == 1
    assert created["submittedSnapshotId"] is None
    assert created["resume"] is None
    assert created["resumeName"] == "No resume selected"
    assert created["job"]["id"] == created["jobId"]

    got = db_client.get(f"{B}/applications/{created['id']}")
    assert got.status_code == 200
    assert got.json() == created


def test_create_application_with_resume_id_fidelity(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    resume = wire_resume_to_row(
        _wire_resume(name="Distributed-systems"), user_id=seed_domain.test_user.id
    )
    db.add(resume)
    db.commit()
    resp = db_client.post(f"{B}/applications", json=_create_body(resume_id=resume.id))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["resumeId"] == str(resume.id)
    assert body["resumeName"] == "Distributed-systems"
    assert body["resume"]["id"] == str(resume.id)
    row = db.get(models.Application, uuid.UUID(body["id"]))
    assert row is not None
    assert row.resume_id == resume.id


def test_create_application_persists_and_assigns_search(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    resp = db_client.post(f"{B}/applications", json=_create_body(company="Beta"))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    row = db.get(models.Application, uuid.UUID(body["id"]))
    assert row is not None
    assert row.user_id == seed_domain.test_user.id
    assert row.stage == "drafting"
    assert row.version == 1
    assert row.search_id is not None
    assert body["searchId"] == str(row.search_id)


# ----------------------------------------------------------- provenance


@pytest.fixture()
def clean_store() -> Generator[None]:
    store.reset()
    yield
    store.reset()


@pytest.mark.usefixtures("clean_store")
def test_db_only_served_store_only_not(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    job = _wire_job(company="DbOwned")
    _insert_job(db, job, seed_domain.test_user.id)
    app_row = _insert_application(db, user_id=seed_domain.test_user.id, job_id=job.id)

    resp = db_client.get(f"{B}/applications")
    assert resp.status_code == 200
    ids = {a["id"] for a in resp.json()}
    assert str(app_row.id) in ids
    assert STRIPE not in ids


def test_recognized_search_id_still_serves_mock_pool(db_client: TestClient) -> None:
    resp = db_client.get(
        f"{B}/applications", params={"searchId": store.SEARCH_ID_BACKEND}
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 3


# -------------------------------------------------------------- tenancy


def test_get_applications_excludes_other_tenant(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    job = _wire_job(company="Not Yours")
    _insert_job(db, job, seed_domain.test_user.id)
    victim_app = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=job.id
    )
    resp = intruder_client.get(f"{B}/applications")
    assert resp.status_code == 200
    assert str(victim_app.id) not in {a["id"] for a in resp.json()}


def test_get_application_cross_tenant_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    job = _wire_job(company="Victim")
    _insert_job(db, job, seed_domain.test_user.id)
    victim_app = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=job.id
    )
    unknown = uuid.uuid4()
    cross = intruder_client.get(f"{B}/applications/{victim_app.id}")
    unk = intruder_client.get(f"{B}/applications/{unknown}")
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim_app.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_create_application_cross_tenant_resume_id_404_indistinguishable(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim_resume = wire_resume_to_row(
        _wire_resume(name="Victim Resume"), user_id=seed_domain.intruder.id
    )
    db.add(victim_resume)
    db.commit()
    unknown = uuid.uuid4()
    cross = db_client.post(
        f"{B}/applications", json=_create_body(resume_id=victim_resume.id)
    )
    unk = db_client.post(f"{B}/applications", json=_create_body(resume_id=unknown))
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim_resume.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )
    # The rejected request minted no application referencing the resume.
    assert (
        db.exec(
            select(models.Application).where(
                models.Application.resume_id == victim_resume.id
            )
        ).first()
        is None
    )


# --------------------------------------------------------------- archive


def test_archive_buckets_and_counts(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    uid = seed_domain.test_user.id
    won_job = _wire_job(company="WonCo")
    rej_job = _wire_job(company="RejCo")
    wd_job = _wire_job(company="WithdrawnCo")
    active_job = _wire_job(company="ActiveCo")
    for j in (won_job, rej_job, wd_job, active_job):
        _insert_job(db, j, uid)

    won_app = _insert_application(
        db, user_id=uid, job_id=won_job.id, stage="won", version=2, outcome="won"
    )
    rej_app = _insert_application(
        db,
        user_id=uid,
        job_id=rej_job.id,
        stage="rejected",
        version=2,
        outcome="rejected",
    )
    wd_app = _insert_application(
        db,
        user_id=uid,
        job_id=wd_job.id,
        stage="withdrew",
        version=2,
        outcome="withdrawn",
    )
    active_app = _insert_application(db, user_id=uid, job_id=active_job.id)

    won_resp = db_client.get(f"{B}/archive", params={"kind": "won"})
    passed_resp = db_client.get(f"{B}/archive", params={"kind": "passed"})
    counts = db_client.get(f"{B}/archive/counts").json()

    won_ids = {a["id"] for a in won_resp.json()}
    passed_ids = {a["id"] for a in passed_resp.json()}
    assert won_ids == {str(won_app.id)}
    assert passed_ids == {str(rej_app.id), str(wd_app.id)}
    assert str(active_app.id) not in won_ids | passed_ids
    assert counts["won"] == 1
    assert counts["passed"] == 2


def test_archive_kind_is_required(db_client: TestClient) -> None:
    """``kind`` stays a REQUIRED query param after the DB flip (re-homes the
    gutted contract file's test_archive_kind_required; apps-verify LOW)."""
    assert db_client.get(f"{B}/archive").status_code == 422


# ---------------------------------------------------------------- drift


def test_application_wire_round_trip_preserves_shape() -> None:
    app = schemas.Application(
        id=uuid.uuid4(),
        jobId=uuid.uuid4(),
        resumeId=uuid.uuid4(),
        stage=schemas.Stage.applied,
        version=3,
        createdAt=datetime.now(UTC),
        flag=schemas.ApplicationFlag.stale,
        contact="Jane Recruiter",
        coachNudge=True,
        resurrected=None,
        outcome=None,
        outcomeAt=None,
        outcomeReason=None,
        outcomeReasons=["comp"],
        systemReasons=["ghosted_auto"],
        submittedSnapshotId=str(uuid.uuid4()),
        searchId=uuid.uuid4(),
    )
    row = wire_application_to_row(app, user_id=uuid.uuid4())
    back = row_to_wire_application(row)
    assert back.model_dump(mode="json") == app.model_dump(mode="json")


# -------------------------------------------- archive tenancy (gate-0.1 GA-2)


def test_get_archive_excludes_other_tenant(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    """getArchive proves tenancy by EXCLUSION (the accepted D2-5 collection-op
    shape): archived victim rows in both buckets are invisible to the
    intruder. Closes gate-0.1 GA-2 for getArchive."""
    won_job = _wire_job(company="ArchWonVictimCo")
    rej_job = _wire_job(company="ArchRejVictimCo")
    _insert_job(db, won_job, seed_domain.test_user.id)
    _insert_job(db, rej_job, seed_domain.test_user.id)
    won_app = _insert_application(
        db,
        user_id=seed_domain.test_user.id,
        job_id=won_job.id,
        stage="won",
        version=2,
        outcome="won",
    )
    rej_app = _insert_application(
        db,
        user_id=seed_domain.test_user.id,
        job_id=rej_job.id,
        stage="rejected",
        version=2,
        outcome="rejected",
    )
    victim_ids = {str(won_app.id), str(rej_app.id)}
    for kind in ("won", "passed"):
        resp = intruder_client.get(f"{B}/archive", params={"kind": kind})
        assert resp.status_code == 200, resp.text
        assert victim_ids.isdisjoint({a["id"] for a in resp.json()})


def test_get_archive_counts_excludes_other_tenant(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    """getArchiveCounts proves tenancy by EXCLUSION: the victim's archived
    rows contribute nothing to the intruder's counts. Closes gate-0.1 GA-2
    for getArchiveCounts."""
    for company, stage, outcome in (
        ("CntWonVictimCo", "won", "won"),
        ("CntRejVictimCo", "rejected", "rejected"),
        ("CntWdVictimCo", "withdrew", "withdrawn"),
    ):
        job = _wire_job(company=company)
        _insert_job(db, job, seed_domain.test_user.id)
        _insert_application(
            db,
            user_id=seed_domain.test_user.id,
            job_id=job.id,
            stage=stage,
            version=2,
            outcome=outcome,
        )
    resp = intruder_client.get(f"{B}/archive/counts")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"won": 0, "passed": 0}
