"""DB-backed resume coverage (sprint-04 3a, AC-03/AC-08/AC-07b).

Fidelity: getResumes/createResume/getResume/patchResume serve/persist
wire-valid shapes from real rows. Tenancy: getResumes excludes other
tenants; getResume/patchResume/deleteResume/duplicateResume/
setDefaultResume/forkResumeAsDraft on a cross-tenant or unknown id are all
tenant-indistinguishable 404s. Lock taxonomy (PIN-17): deleteResume 409s for
each LOCKED tag and for usedIn > 0, and the FK backstop disambiguates a
reference the app-level check doesn't see to the SAME 409 envelope.
Default-swap (PIN-5): the previous DEFAULT demotes to VARIANT and exactly one
DEFAULT survives. Provenance (PIN-9): a store-only mock fixture is not
served; a DB-only row is. Drift: wire -> row -> wire round-trips.
"""

from __future__ import annotations

import threading
import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import crud, models, schemas, store
from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.job_mapper import wire_job_to_row
from app.main import app
from app.models import UserCreate
from app.resume_mapper import row_to_wire_resume, wire_resume_to_row
from tests.conftest import SeededUsers
from tests.utils.utils import random_email, random_lower_string

B = "/api/v1"


def _wire_resume(
    *,
    name: str = "Distributed-systems",
    subtitle: str = "For Staff / Principal IC roles",
    version: str = "v4",
    used_in: int = 0,
    tag: schemas.ResumeTag = schemas.ResumeTag.VARIANT,
    match: int | None = None,
    body: str | None = "Body copy.",
    source_upload_id: uuid.UUID | None = None,
    template_id: uuid.UUID | None = None,
    target_role: str | None = None,
    scoring_enabled: bool | None = None,
) -> schemas.Resume:
    return schemas.Resume.model_validate(
        {
            "id": str(uuid.uuid4()),
            "name": name,
            "subtitle": subtitle,
            "version": version,
            "usedIn": used_in,
            "updated": datetime.now(UTC).isoformat(),
            "tag": tag.value,
            "match": match,
            "body": body,
            "sourceUploadId": str(source_upload_id) if source_upload_id else None,
            "templateId": str(template_id) if template_id else None,
            "targetRole": target_role,
            "scoringEnabled": scoring_enabled,
        }
    )


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


# ------------------------------------------------------------- fidelity


def test_get_resumes_serves_own_rows(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    db.add(
        wire_resume_to_row(_wire_resume(name="Mine"), user_id=seed_domain.test_user.id)
    )
    db.commit()
    resp = db_client.get(f"{B}/resumes")
    assert resp.status_code == 200
    body = resp.json()
    assert "Mine" in {r["name"] for r in body}
    for r in body:
        schemas.Resume.model_validate(r)


def test_get_resumes_id_tiebreak_on_equal_updated(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    """RV-4 closure: with IDENTICAL updated timestamps the list falls back to
    the id tie-break, so ordering is deterministic under collision."""
    same_instant = datetime.now(UTC)
    rows = []
    for name in ("Tie-A", "Tie-B", "Tie-C"):
        wire = _wire_resume(name=name)
        wire.updated = same_instant
        row = wire_resume_to_row(wire, user_id=seed_domain.test_user.id)
        db.add(row)
        rows.append(row)
    db.commit()
    expected = [r.name for r in sorted(rows, key=lambda r: r.id.hex)]
    body = db_client.get(f"{B}/resumes").json()
    listed = [r["name"] for r in body if r["name"].startswith("Tie-")]
    assert listed == expected


def test_create_resume_defaults_and_persists(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    resp = db_client.post(f"{B}/resumes")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Untitled revision"
    assert body["subtitle"] == ""
    assert body["version"] == "v1"
    assert body["usedIn"] == 0
    assert body["tag"] == "DRAFT"
    assert body["body"] == ""
    row = db.get(models.Resume, uuid.UUID(body["id"]))
    assert row is not None
    assert row.user_id == seed_domain.test_user.id


def test_patch_resume_merges_only_sent_fields(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    resume = wire_resume_to_row(
        _wire_resume(
            name="Founder narrative",
            subtitle="Different framing - exploring",
            tag=schemas.ResumeTag.DRAFT,
        ),
        user_id=seed_domain.test_user.id,
    )
    db.add(resume)
    db.commit()
    resp = db_client.patch(
        f"{B}/resumes/{resume.id}", json={"name": "Founder narrative v2"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Founder narrative v2"
    # Untouched fields preserved.
    assert body["tag"] == "DRAFT"
    assert body["subtitle"] == "Different framing - exploring"

    resp2 = db_client.patch(
        f"{B}/resumes/{resume.id}", json={"scoringEnabled": False}
    )
    body2 = resp2.json()
    assert body2["scoringEnabled"] is False
    # Rename from the previous PATCH persisted.
    assert body2["name"] == "Founder narrative v2"


def test_duplicate_resume_semantics(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    source = wire_resume_to_row(
        _wire_resume(
            name="Platform / infra",
            subtitle="Developer-platform emphasis",
            tag=schemas.ResumeTag.VARIANT,
            used_in=3,
            match=84,
            body="Reordered for dev-platform roles.",
        ),
        user_id=seed_domain.test_user.id,
    )
    db.add(source)
    db.commit()
    resp = db_client.post(f"{B}/resumes/{source.id}/duplicate")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id"] != str(source.id)
    assert body["name"] == "Platform / infra (copy)"
    assert body["tag"] == "DRAFT"
    assert body["usedIn"] == 0
    # Non-mutated fields carried over from the source.
    assert body["subtitle"] == "Developer-platform emphasis"
    assert body["body"] == "Reordered for dev-platform roles."
    row = db.get(models.Resume, uuid.UUID(body["id"]))
    assert row is not None
    # A plain duplicate is a fresh DRAFT, never a fork.
    assert row.fork_job_id is None


def test_fork_resume_as_draft_creates_tailored_draft(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    basis = wire_resume_to_row(
        _wire_resume(
            name="Master", tag=schemas.ResumeTag.MASTER, body="Full career history."
        ),
        user_id=seed_domain.test_user.id,
    )
    db.add(basis)
    job = wire_job_to_row(_wire_job(), user_id=seed_domain.test_user.id)
    db.add(job)
    db.commit()
    resp = db_client.post(
        f"{B}/resumes/{basis.id}/fork", json={"jobId": str(job.id)}
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id"] != str(basis.id)
    assert body["name"] == "Master - tailored draft"
    assert body["tag"] == "DRAFT"
    assert body["usedIn"] == 0
    assert body["body"] == "Full career history."
    row = db.get(models.Resume, uuid.UUID(body["id"]))
    assert row is not None
    assert row.fork_job_id == job.id


def test_set_default_resume_demotes_previous_default(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    old_default = wire_resume_to_row(
        _wire_resume(name="Distributed-systems", tag=schemas.ResumeTag.DEFAULT),
        user_id=seed_domain.test_user.id,
    )
    candidate = wire_resume_to_row(
        _wire_resume(name="Platform / infra", tag=schemas.ResumeTag.VARIANT),
        user_id=seed_domain.test_user.id,
    )
    db.add(old_default)
    db.add(candidate)
    db.commit()
    resp = db_client.post(f"{B}/resumes/{candidate.id}/set-default")
    assert resp.status_code == 200, resp.text
    collection = {r["id"]: r for r in resp.json()}
    assert collection[str(candidate.id)]["tag"] == "DEFAULT"
    assert collection[str(old_default.id)]["tag"] == "VARIANT"

    # Persisted, and exactly one DEFAULT survives (uq_resume_user_default).
    defaults = db.exec(
        select(models.Resume)
        .where(models.Resume.user_id == seed_domain.test_user.id)
        .where(models.Resume.tag == "DEFAULT")
    ).all()
    assert [r.id for r in defaults] == [candidate.id]


def test_set_default_resume_unknown_target_404(
    db_client: TestClient, seed_domain: SeededUsers
) -> None:
    resp = db_client.post(f"{B}/resumes/{uuid.uuid4()}/set-default")
    assert resp.status_code == 404


# -------------------------------------------------------------- tenancy


def test_get_resumes_excludes_other_tenant(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    db.add(
        wire_resume_to_row(
            _wire_resume(name="Not Yours"), user_id=seed_domain.intruder.id
        )
    )
    db.commit()
    resp = db_client.get(f"{B}/resumes")
    assert "Not Yours" not in {r["name"] for r in resp.json()}


def test_intruder_sees_zero_victim_rows(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    db.add(
        wire_resume_to_row(
            _wire_resume(name="Victim Resume"), user_id=seed_domain.test_user.id
        )
    )
    db.commit()
    resp = intruder_client.get(f"{B}/resumes")
    assert resp.status_code == 200
    assert "Victim Resume" not in {r["name"] for r in resp.json()}


def test_get_resume_cross_tenant_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim = wire_resume_to_row(_wire_resume(), user_id=seed_domain.test_user.id)
    db.add(victim)
    db.commit()
    unknown = uuid.uuid4()
    cross = intruder_client.get(f"{B}/resumes/{victim.id}")
    unk = intruder_client.get(f"{B}/resumes/{unknown}")
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_patch_resume_cross_tenant_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim = wire_resume_to_row(_wire_resume(), user_id=seed_domain.test_user.id)
    db.add(victim)
    db.commit()
    unknown = uuid.uuid4()
    payload = {"name": "Hijacked"}
    cross = intruder_client.patch(f"{B}/resumes/{victim.id}", json=payload)
    unk = intruder_client.patch(f"{B}/resumes/{unknown}", json=payload)
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )
    assert db.get(models.Resume, victim.id).name != "Hijacked"  # type: ignore[union-attr]


def test_delete_resume_cross_tenant_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim = wire_resume_to_row(
        _wire_resume(tag=schemas.ResumeTag.DRAFT), user_id=seed_domain.test_user.id
    )
    db.add(victim)
    db.commit()
    unknown = uuid.uuid4()
    cross = intruder_client.delete(f"{B}/resumes/{victim.id}")
    unk = intruder_client.delete(f"{B}/resumes/{unknown}")
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )
    assert db.get(models.Resume, victim.id) is not None


def test_duplicate_resume_cross_tenant_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim = wire_resume_to_row(_wire_resume(), user_id=seed_domain.test_user.id)
    db.add(victim)
    db.commit()
    unknown = uuid.uuid4()
    cross = intruder_client.post(f"{B}/resumes/{victim.id}/duplicate")
    unk = intruder_client.post(f"{B}/resumes/{unknown}/duplicate")
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_set_default_resume_cross_tenant_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim = wire_resume_to_row(_wire_resume(), user_id=seed_domain.test_user.id)
    db.add(victim)
    db.commit()
    unknown = uuid.uuid4()
    cross = intruder_client.post(f"{B}/resumes/{victim.id}/set-default")
    unk = intruder_client.post(f"{B}/resumes/{unknown}/set-default")
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_fork_resume_as_draft_cross_tenant_resume_id_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim = wire_resume_to_row(_wire_resume(), user_id=seed_domain.test_user.id)
    db.add(victim)
    own_job = wire_job_to_row(
        _wire_job(company="IntruderCo"), user_id=seed_domain.intruder.id
    )
    db.add(own_job)
    db.commit()
    unknown = uuid.uuid4()
    payload = {"jobId": str(own_job.id)}
    cross = intruder_client.post(f"{B}/resumes/{victim.id}/fork", json=payload)
    unk = intruder_client.post(f"{B}/resumes/{unknown}/fork", json=payload)
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_fork_resume_as_draft_foreign_job_id_404_indistinguishable(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    basis = wire_resume_to_row(_wire_resume(), user_id=seed_domain.test_user.id)
    db.add(basis)
    victim_job = wire_job_to_row(
        _wire_job(company="Victim"), user_id=seed_domain.intruder.id
    )
    db.add(victim_job)
    db.commit()
    unknown_job = uuid.uuid4()
    cross = db_client.post(
        f"{B}/resumes/{basis.id}/fork", json={"jobId": str(victim_job.id)}
    )
    unk = db_client.post(
        f"{B}/resumes/{basis.id}/fork", json={"jobId": str(unknown_job)}
    )
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim_job.id), "<ID>") == unk.text.replace(
        str(unknown_job), "<ID>"
    )


# --------------------------------------------------- lock/delete taxonomy


@pytest.mark.parametrize(
    "tag",
    [schemas.ResumeTag.TAILORED, schemas.ResumeTag.MASTER, schemas.ResumeTag.DEFAULT],
)
def test_delete_resume_locked_tag_returns_409(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    tag: schemas.ResumeTag,
) -> None:
    resume = wire_resume_to_row(
        _wire_resume(tag=tag, used_in=0), user_id=seed_domain.test_user.id
    )
    db.add(resume)
    db.commit()
    resp = db_client.delete(f"{B}/resumes/{resume.id}")
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"
    assert db.get(models.Resume, resume.id) is not None


def test_delete_resume_used_in_positive_returns_409(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    resume = wire_resume_to_row(
        _wire_resume(tag=schemas.ResumeTag.VARIANT, used_in=3),
        user_id=seed_domain.test_user.id,
    )
    db.add(resume)
    db.commit()
    resp = db_client.delete(f"{B}/resumes/{resume.id}")
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"


def test_delete_resume_removes_unlocked_draft(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    resume = wire_resume_to_row(
        _wire_resume(tag=schemas.ResumeTag.DRAFT, used_in=0),
        user_id=seed_domain.test_user.id,
    )
    db.add(resume)
    db.commit()
    resp = db_client.delete(f"{B}/resumes/{resume.id}")
    assert resp.status_code == 204
    assert db.get(models.Resume, resume.id) is None


def test_delete_resume_fk_backstop_via_application_reference(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    """PIN-17: a resume the app-level check sees as UNLOCKED (VARIANT,
    usedIn=0) but that an ``application.resume_id`` still references refuses
    delete via the ``fk_application_resume`` composite FK, disambiguated to
    the SAME 409 conflict envelope (not a 500)."""
    resume = wire_resume_to_row(
        _wire_resume(tag=schemas.ResumeTag.VARIANT, used_in=0),
        user_id=seed_domain.test_user.id,
    )
    db.add(resume)
    job = wire_job_to_row(_wire_job(), user_id=seed_domain.test_user.id)
    db.add(job)
    db.commit()
    referencing_app = models.Application(
        id=uuid.uuid4(),
        user_id=seed_domain.test_user.id,
        job_id=job.id,
        resume_id=resume.id,
        stage="applied",
        version=1,
    )
    db.add(referencing_app)
    db.commit()

    resp = db_client.delete(f"{B}/resumes/{resume.id}")
    assert resp.status_code == 409, resp.text
    assert resp.json()["kind"] == "conflict"
    assert db.get(models.Resume, resume.id) is not None


# ----------------------------------------------------------- provenance


@pytest.fixture()
def clean_store() -> Generator[None]:
    store.reset()
    yield
    store.reset()


@pytest.mark.usefixtures("clean_store")
def test_store_only_row_not_served_db_only_row_is(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    ghost = _wire_resume(name="Store Ghost")
    store.resumes[ghost.id] = ghost
    db.add(
        wire_resume_to_row(_wire_resume(name="DB Real"), user_id=seed_domain.test_user.id)
    )
    db.commit()
    names = {r["name"] for r in db_client.get(f"{B}/resumes").json()}
    assert "DB Real" in names
    assert "Store Ghost" not in names


# ---------------------------------------------------------------- drift


def test_wire_round_trip_preserves_shape() -> None:
    for resume in (
        _wire_resume(
            tag=schemas.ResumeTag.MASTER,
            match=None,
            body=None,
            source_upload_id=uuid.uuid4(),
            template_id=uuid.uuid4(),
            target_role="Staff Engineer",
            scoring_enabled=True,
        ),
        _wire_resume(tag=schemas.ResumeTag.DRAFT),
    ):
        row = wire_resume_to_row(resume, user_id=uuid.uuid4())
        back = row_to_wire_resume(row)
        assert back.model_dump(mode="json") == resume.model_dump(mode="json")


# ------------------------------------------------- default-swap race (GA-1)


def test_two_connection_default_swap_no_deadlock_one_default() -> None:
    """Two CONCURRENT opposite-direction setDefaultResume requests (each
    promoting the resume the other would demote) -> both complete without
    deadlock and exactly one DEFAULT survives (PIN-5; gate-0.1 GA-1).

    The user-row ``FOR UPDATE`` lock is the serialization point: both
    requests succeed 200 in some order, and whichever commits second holds
    DEFAULT. Runs on a THROWAWAY committed user outside the rollback fixture
    (threaded requests need rows visible across connections), mirroring the
    lifecycle race tests; teardown via delete_user_with_history (PIN-11).
    """
    with Session(engine) as s:
        user = crud.create_user(
            session=s,
            user_create=UserCreate(
                email=random_email(), password=random_lower_string()
            ),
        )
        uid = user.id
        res_a = wire_resume_to_row(
            _wire_resume(name="Swap A", tag=schemas.ResumeTag.DEFAULT),
            user_id=uid,
        )
        res_b = wire_resume_to_row(
            _wire_resume(name="Swap B", tag=schemas.ResumeTag.VARIANT),
            user_id=uid,
        )
        s.add(res_a)
        s.add(res_b)
        s.commit()
        id_a, id_b = res_a.id, res_b.id
        session_version = user.session_version

    auth_token = security.create_access_token(
        uid,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        session_version=session_version,
    )
    headers = {"Authorization": f"Bearer {auth_token}"}
    results: list[tuple[int, object]] = []
    lock = threading.Lock()

    try:
        with TestClient(app) as c:
            c.headers.update(headers)

            def _promote(target: uuid.UUID) -> None:
                resp = c.post(f"{B}/resumes/{target}/set-default")
                with lock:
                    results.append((resp.status_code, resp.json()))

            t1 = threading.Thread(target=_promote, args=(id_b,))
            t2 = threading.Thread(target=_promote, args=(id_a,))
            t1.start()
            t2.start()
            t1.join(timeout=20)
            t2.join(timeout=20)
            assert not t1.is_alive() and not t2.is_alive(), (
                "deadlock: a swap request never completed"
            )

        statuses = sorted(r[0] for r in results)
        assert statuses == [200, 200], results

        with Session(engine) as s:
            defaults = s.exec(
                select(models.Resume)
                .where(models.Resume.user_id == uid)
                .where(models.Resume.tag == "DEFAULT")
            ).all()
            assert len(defaults) == 1, [
                (r.id, r.tag)
                for r in s.exec(
                    select(models.Resume).where(models.Resume.user_id == uid)
                ).all()
            ]
            assert defaults[0].id in (id_a, id_b)
    finally:
        with Session(engine) as s:
            crud.delete_user_with_history(session=s, user_id=uid)
            s.commit()
