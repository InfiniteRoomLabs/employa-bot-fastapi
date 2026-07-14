"""DB-backed jobs coverage (sprint-02, AC-02/AC-03 in sprint-02-spec.md).

Fidelity: getJobs/getJob serve wire-valid shapes from real rows.
Tenancy: the ownership matrix -- collection filtering, tenant-indistinguishable
id-addressed 404s, and caller-stamped capture writes. The contract exposes NO
job mutation operation (getJobs/getJobsInbox/getJob are the only jobs ops),
so the write half of the matrix is exactly the createApplication mint path.
Provenance: the discriminators that make the manifest flip falsifiable -- a
store-only job is NOT served, a DB-only job IS.
Drift (PIN-4): every wire fixture survives wire -> row -> wire unchanged.
"""

from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import models, schemas, store
from app.job_mapper import row_to_wire_job, wire_job_to_row
from tests.conftest import SeededUsers

B = "/api/v1"


def _wire_job(
    *, company: str = "Probe Co", url: str | None = None
) -> schemas.Job:
    payload: dict[str, object] = {
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
        "compensation": {"min": 200000, "max": 250000, "extra": []},
        "source": {
            "board": "greenhouse",
            "channel": "url",
            "capturedAt": datetime.now(UTC).isoformat(),
        },
        "posted": datetime.now(UTC).isoformat(),
    }
    if url is not None:
        source = payload["source"]
        assert isinstance(source, dict)
        source["url"] = url
    return schemas.Job.model_validate(payload)


def _insert(db: Session, job: schemas.Job, user_id: uuid.UUID) -> models.Job:
    row = wire_job_to_row(job, user_id=user_id)
    db.add(row)
    db.commit()
    return row


@pytest.fixture()
def clean_store() -> Generator[None]:
    """Pristine store around tests that drive dual-write mock ops."""
    store.reset()
    yield
    store.reset()


# ---------------------------------------------------------------- fidelity


def test_get_jobs_serves_own_rows_in_wire_shape(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    mine = [_wire_job(company="Mine One"), _wire_job(company="Mine Two")]
    for job in mine:
        _insert(db, job, seed_domain.test_user.id)

    resp = db_client.get(f"{B}/jobs")
    assert resp.status_code == 200
    body = resp.json()
    ids = {item["id"] for item in body}
    assert {str(j.id) for j in mine} <= ids
    for item in body:
        schemas.Job.model_validate(item)  # wire fidelity


def test_get_job_wire_fidelity(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    job = _wire_job(company="Fidelity Co", url="https://boards.example.com/x/1")
    _insert(db, job, seed_domain.test_user.id)

    resp = db_client.get(f"{B}/jobs/{job.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["company"] == "Fidelity Co"
    assert body["compensation"] == {"min": 200000, "max": 250000, "extra": []}
    assert body["employment"]["classification"] == "w2"
    schemas.Job.model_validate(body)


# ----------------------------------------------------------------- tenancy


def test_get_jobs_excludes_other_tenants_rows(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    theirs = _wire_job(company="Not Yours Inc")
    _insert(db, theirs, seed_domain.intruder.id)

    resp = db_client.get(f"{B}/jobs")
    assert resp.status_code == 200
    assert str(theirs.id) not in {item["id"] for item in resp.json()}


def test_cross_tenant_get_job_404_indistinguishable_from_unknown(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim_job = _wire_job(company="Victim Corp")
    _insert(db, victim_job, seed_domain.test_user.id)
    unknown_id = uuid.uuid4()

    cross = intruder_client.get(f"{B}/jobs/{victim_job.id}")
    unknown = intruder_client.get(f"{B}/jobs/{unknown_id}")

    assert cross.status_code == unknown.status_code == 404
    # The envelope's path echoes the request URL; normalize the ids out and
    # the two misses must be byte-identical -- tenant-indistinguishable.
    cross_body = cross.text.replace(str(victim_job.id), "<ID>")
    unknown_body = unknown.text.replace(str(unknown_id), "<ID>")
    assert cross_body == unknown_body


@pytest.mark.usefixtures("clean_store")
def test_create_application_mints_job_for_caller_only(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
) -> None:
    resp = db_client.post(
        f"{B}/applications",
        json={
            "company": "Minted Co",
            "role": "Staff Engineer",
            "location": "Remote - US",
            "salary": {"min": 210000, "max": 240000, "extra": []},
            "match": 0,
            "source": "manual",
        },
    )
    assert resp.status_code == 201
    job_id = uuid.UUID(resp.json()["job"]["id"])

    row = db.get(models.Job, job_id)
    assert row is not None, "createApplication must persist the job row"
    assert row.user_id == seed_domain.test_user.id
    assert row.company == "Minted Co"
    assert row.schema_version == 1
    # Dual-write (PIN-1): the store copy feeds the mock joins.
    assert job_id in store.jobs


# -------------------------------------------------------------- provenance


@pytest.mark.usefixtures("clean_store")
def test_store_only_job_is_not_served(db_client: TestClient) -> None:
    ghost = _wire_job(company="Store Ghost")
    store.jobs[ghost.id] = ghost  # store only, never inserted

    listed = db_client.get(f"{B}/jobs")
    assert str(ghost.id) not in {item["id"] for item in listed.json()}
    assert db_client.get(f"{B}/jobs/{ghost.id}").status_code == 404


@pytest.mark.usefixtures("clean_store")
def test_db_only_job_is_served(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
) -> None:
    job = _wire_job(company="DB Only Co")
    _insert(db, job, seed_domain.test_user.id)
    assert job.id not in store.jobs

    resp = db_client.get(f"{B}/jobs/{job.id}")
    assert resp.status_code == 200
    assert resp.json()["company"] == "DB Only Co"


# ------------------------------------------------------------------- drift


def test_every_demo_fixture_round_trips_wire_row_wire() -> None:
    """PIN-4 drift artifact: the DB row loses nothing the wire expresses."""
    seeds = store.demo_job_seeds()
    assert len(seeds) == 7
    for job in seeds.values():
        row = wire_job_to_row(job, user_id=uuid.uuid4())
        back = row_to_wire_job(row)
        assert back.model_dump(mode="json") == job.model_dump(mode="json")
