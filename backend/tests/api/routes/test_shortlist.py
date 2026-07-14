"""DB-backed shortlist coverage (sprint-03, AC-03/AC-04/AC-02b).

Fidelity: getShortlist(default)/add serve wire-valid shapes from real rows.
Tenancy: getShortlist excludes other tenants; cross-tenant dismiss is a
tenant-indistinguishable 404; a cross-tenant jobId in addToShortlist is
rejected by the composite FK. Dedup: a duplicate (user_id, job_id) -> 409;
the concurrent race yields exactly one 201. Provenance: store-only entries
are not served; a mock searchId view is still served. Drift: wire->row->wire.
"""

from __future__ import annotations

import contextlib
import threading
import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, delete, select

from app import models, schemas, store
from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.job_mapper import wire_job_to_row
from app.main import app
from app.shortlist_mapper import row_to_wire_shortlist, wire_shortlist_to_row
from tests.conftest import SeededUsers

B = "/api/v1"


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


def _wire_entry(
    *, job_id: uuid.UUID | None = None, company: str = "Stripe"
) -> schemas.ShortlistEntry:
    return schemas.ShortlistEntry.model_validate(
        {
            "id": str(uuid.uuid4()),
            "jobId": str(job_id) if job_id else None,
            "company": company,
            "role": "Staff Engineer",
            "location": "Remote - US",
            "salary": {"min": 200000, "max": 250000, "extra": []},
            "match": 92,
            "saved": datetime.now(UTC).isoformat(),
            "source": "you",
        }
    )


def _add_body(job_id: uuid.UUID | None = None, company: str = "Stripe") -> dict:
    body: dict = {
        "company": company,
        "role": "Staff Engineer",
        "location": "Remote - US",
        "salary": {"min": 200000, "max": 250000, "extra": []},
        "match": 92,
    }
    if job_id is not None:
        body["jobId"] = str(job_id)
    return body


# ------------------------------------------------------------- fidelity


def test_get_shortlist_serves_own_rows(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    db.add(
        wire_shortlist_to_row(
            _wire_entry(company="Mine"), user_id=seed_domain.test_user.id
        )
    )
    db.commit()
    resp = db_client.get(f"{B}/shortlist")
    assert resp.status_code == 200
    body = resp.json()
    assert "Mine" in {e["company"] for e in body}
    for e in body:
        schemas.ShortlistEntry.model_validate(e)


def test_add_to_shortlist_stamps_caller(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    job = _wire_job()
    _insert_job(db, job, seed_domain.test_user.id)
    resp = db_client.post(f"{B}/shortlist", json=_add_body(job.id))
    assert resp.status_code == 201, resp.text
    entry_id = uuid.UUID(resp.json()["id"])
    row = db.get(models.ShortlistEntry, entry_id)
    assert row is not None
    assert row.user_id == seed_domain.test_user.id
    assert row.job_id == job.id


# -------------------------------------------------------------- tenancy


def test_unrecognized_searchid_falls_to_db_default(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    """SIM-2: an unrecognized searchId no longer serves the write-dead
    store.shortlist snapshot -- it falls through to the caller's DB shortlist."""
    db.add(
        wire_shortlist_to_row(
            _wire_entry(company="MyDbEntry"), user_id=seed_domain.test_user.id
        )
    )
    db.commit()
    resp = db_client.get(f"{B}/shortlist", params={"searchId": str(uuid.uuid4())})
    assert resp.status_code == 200
    assert "MyDbEntry" in {e["company"] for e in resp.json()}


def test_get_shortlist_excludes_other_tenant(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    db.add(
        wire_shortlist_to_row(
            _wire_entry(company="Not Yours"), user_id=seed_domain.intruder.id
        )
    )
    db.commit()
    resp = db_client.get(f"{B}/shortlist")
    assert "Not Yours" not in {e["company"] for e in resp.json()}


def test_cross_tenant_dismiss_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim = wire_shortlist_to_row(
        _wire_entry(company="Victim"), user_id=seed_domain.test_user.id
    )
    db.add(victim)
    db.commit()
    unknown = uuid.uuid4()
    cross = intruder_client.delete(f"{B}/shortlist/{victim.id}")
    unk = intruder_client.delete(f"{B}/shortlist/{unknown}")
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_add_with_cross_tenant_job_id_is_404(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    victim_job = _wire_job(company="Victim Job")
    _insert_job(db, victim_job, seed_domain.intruder.id)
    unknown_job = uuid.uuid4()
    cross = db_client.post(f"{B}/shortlist", json=_add_body(victim_job.id))
    unk = db_client.post(f"{B}/shortlist", json=_add_body(unknown_job))
    # Not-owned jobId (cross-tenant or unknown) -> tenant-indistinguishable 404,
    # and no row is created (the composite FK is the DB backstop).
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(victim_job.id), "<ID>") == unk.text.replace(
        str(unknown_job), "<ID>"
    )
    assert (
        db.exec(
            select(models.ShortlistEntry).where(
                models.ShortlistEntry.job_id == victim_job.id
            )
        ).first()
        is None
    )


# --------------------------------------------------------------- dedup


def test_duplicate_add_returns_409(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    job = _wire_job()
    _insert_job(db, job, seed_domain.test_user.id)
    first = db_client.post(f"{B}/shortlist", json=_add_body(job.id))
    assert first.status_code == 201
    dup = db_client.post(f"{B}/shortlist", json=_add_body(job.id))
    assert dup.status_code == 409
    assert dup.json()["kind"] == "conflict"


def test_concurrent_route_add_one_201_one_409(
    seed_domain: SeededUsers,
) -> None:
    """Two CONCURRENT addToShortlist requests for the same (user_id, job_id),
    driven through the ROUTE on two threads -> EXACTLY one 201 and one 409, and
    exactly one row (AC-02b). This proves the losing concurrent request maps to
    the 409 conflict envelope, not just that the DB index blocks (which the
    two-connection test below proves at the SQL layer). Runs outside the
    rollback fixture; cleaned up explicitly."""
    uid = seed_domain.test_user.id
    job = _wire_job(company="RaceHTTP")
    with Session(engine) as s:
        s.add(wire_job_to_row(job, user_id=uid))
        s.commit()
    token = security.create_access_token(
        uid,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        session_version=seed_domain.test_user.session_version,
    )
    headers = {"Authorization": f"Bearer {token}"}
    statuses: list[int] = []
    lock = threading.Lock()

    # ONE client shared by both threads: two `with TestClient(app)` blocks would
    # run the app lifespan concurrently and corrupt shared state. httpx is
    # thread-safe for concurrent requests.
    try:
        with TestClient(app) as c:
            c.headers.update(headers)

            def _attempt() -> None:
                resp = c.post(f"{B}/shortlist", json=_add_body(job.id))
                with lock:
                    statuses.append(resp.status_code)

            t1 = threading.Thread(target=_attempt)
            t2 = threading.Thread(target=_attempt)
            t1.start()
            t2.start()
            t1.join(timeout=20)
            t2.join(timeout=20)
        assert sorted(statuses) == [201, 409], statuses
        with Session(engine) as s:
            rows = s.exec(
                select(models.ShortlistEntry).where(
                    models.ShortlistEntry.job_id == job.id
                )
            ).all()
            assert len(rows) == 1
    finally:
        with Session(engine) as s:
            s.exec(
                delete(models.ShortlistEntry).where(
                    models.ShortlistEntry.job_id == job.id
                )
            )
            s.exec(delete(models.Job).where(models.Job.id == job.id))
            s.commit()


def test_two_connection_duplicate_add_one_winner(
    seed_domain: SeededUsers,
) -> None:
    """A GENUINE two-connection race on the same (user_id, job_id), proved
    deterministically (D2-1): connection A inserts the row and holds its
    transaction OPEN (the unique-index key is locked); connection B, under a
    short lock_timeout, tries to insert the SAME key WHILE A is still open and
    is BLOCKED -> it raises (contention is real, not sequential). A then
    commits, and exactly one row remains. This is the two-connection pattern
    sprint-04 leans on. Runs outside the rollback fixture on two real
    connections, cleaned up explicitly."""
    uid = seed_domain.test_user.id
    job = _wire_job(company="Race")
    with Session(engine) as s:
        s.add(wire_job_to_row(job, user_id=uid))
        s.commit()

    conn_a = engine.connect()
    conn_b = engine.connect()
    try:
        for c in (conn_a, conn_b):
            c.execute(text("SET ROLE app_runtime"))
            c.execute(
                text("SELECT set_config('app.user_id', :uid, false)"),
                {"uid": str(uid)},
            )

        def _insert(c: object) -> None:
            entry = wire_shortlist_to_row(_wire_entry(job_id=job.id), user_id=uid)
            c.execute(  # type: ignore[attr-defined]
                text(
                    "INSERT INTO shortlist_entry"
                    " (id, user_id, job_id, company, role, location, match, source)"
                    " VALUES (:id, :uid, :jid, 'S', 'E', 'R', 90, 'you')"
                ),
                {"id": entry.id, "uid": uid, "jid": job.id},
            )

        # A inserts and holds its transaction open (key locked, uncommitted).
        _insert(conn_a)
        # B, with a short lock_timeout, tries the SAME key while A is open ->
        # it BLOCKS on the index key and times out: contention is real.
        conn_b.execute(text("SET LOCAL lock_timeout = '750ms'"))
        with pytest.raises(OperationalError):
            _insert(conn_b)
        conn_b.rollback()
        conn_a.commit()  # the winner

        with Session(engine) as s:
            rows = s.exec(
                select(models.ShortlistEntry).where(
                    models.ShortlistEntry.job_id == job.id
                )
            ).all()
            assert len(rows) == 1
    finally:
        # These connections carry a session-level SET ROLE app_runtime, which
        # rollback/close do NOT clear; a reused pooled connection would then run
        # as app_runtime and, under FORCE RLS, break a later test's owner-role
        # insert. invalidate() discards them from the pool entirely -- bulletproof.
        for c in (conn_a, conn_b):
            with contextlib.suppress(Exception):
                c.invalidate()
            c.close()
        with Session(engine) as s:
            s.exec(
                delete(models.ShortlistEntry).where(
                    models.ShortlistEntry.job_id == job.id
                )
            )
            s.exec(delete(models.Job).where(models.Job.id == job.id))
            s.commit()


def test_null_job_entries_not_deduped(db_client: TestClient) -> None:
    a = db_client.post(f"{B}/shortlist", json=_add_body(None, company="A"))
    b = db_client.post(f"{B}/shortlist", json=_add_body(None, company="B"))
    assert a.status_code == 201 and b.status_code == 201


# ----------------------------------------------------------- provenance


@pytest.fixture()
def clean_store() -> Generator[None]:
    store.reset()
    yield
    store.reset()


@pytest.mark.usefixtures("clean_store")
def test_store_only_entry_not_served(db_client: TestClient) -> None:
    ghost = _wire_entry(company="Store Ghost")
    store.shortlist[ghost.id] = ghost
    listed = db_client.get(f"{B}/shortlist")
    assert "Store Ghost" not in {e["company"] for e in listed.json()}


# ---------------------------------------------------------------- drift


def test_every_seed_entry_round_trips() -> None:
    seeds = store.demo_shortlist_seeds()
    assert len(seeds) >= 1
    for entry in seeds:
        row = wire_shortlist_to_row(entry, user_id=uuid.uuid4())
        back = row_to_wire_shortlist(row)
        assert back.model_dump(mode="json") == entry.model_dump(mode="json")
