"""DB-backed transitionApplication + getResumeSnapshot coverage (sprint-04 3b,
AC-04/AC-05/AC-08).

transitionApplication and getResumeSnapshot are the two ops that flip in this
checkpoint (docs/sprints/sprint-04-spec.md 3b design). Both are now DB-only:
mock store fixtures are no longer transitionable (their matrix/version/
snapshot coverage retired from ``tests/contract/test_applications.py`` here).

Sections (lettered to match the sprint-04 3b test-writer brief):

a. Full legal-matrix port -- every edge in ``LEGAL_TRANSITIONS`` accepted,
   with a real ``stage_transition`` row appended.
b. Illegal edges rejected, no transition row created.
c. Check order (mock parity): 404 -> 409 conflict -> 422 invalid_transition
   -> 422 validation_error -> 404 resume-not-found (tenant-indistinguishable).
d. AC-04a: a zero-row guarded-UPDATE abort leaves no child writes.
e. AC-04c (PIN-2): an induced APPLIED-atomicity failure rolls back
   everything -- the discriminating rollback proof.
f. AC-04b: the two-connection race, at the route AND at the SQL layer.
g. PIN-2 happy path: snapshot + resume lock in the same transaction, plus
   the resulting deleteResume lock-conflict.
h. Tenancy: cross-tenant transitions are a byte-identical 404.
i. getResumeSnapshot: real row takes precedence, DB-side conflict/404, and
   the mock-parity synthesis fallback for a stage-past-drafting application
   with no snapshot row.
"""

from __future__ import annotations

import threading
import uuid
from datetime import UTC, datetime, timedelta
from uuid import NAMESPACE_URL, uuid5

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlmodel import Session, select

from app import crud, models, schemas
from app.api.routes.applications import LEGAL_TRANSITIONS
from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.job_mapper import wire_job_to_row
from app.main import app
from app.models import UserCreate
from app.resume_mapper import wire_resume_to_row
from app.schemas import Stage
from tests.conftest import SeededUsers
from tests.utils.utils import random_email, random_lower_string

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


def _wire_resume(
    name: str = "Distributed-systems", body: str | None = "Body copy."
) -> schemas.Resume:
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
            "body": body,
            "sourceUploadId": None,
            "templateId": None,
            "targetRole": None,
            "scoringEnabled": None,
        }
    )


def _insert_application(
    db: Session,
    *,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    resume_id: uuid.UUID | None = None,
    stage: str = "drafting",
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


@pytest.fixture()
def owned_job(db: Session, seed_domain: SeededUsers) -> models.Job:
    job = wire_job_to_row(_wire_job(), user_id=seed_domain.test_user.id)
    db.add(job)
    db.commit()
    return job


@pytest.fixture()
def owned_resume(db: Session, seed_domain: SeededUsers) -> models.Resume:
    resume = wire_resume_to_row(_wire_resume(), user_id=seed_domain.test_user.id)
    db.add(resume)
    db.commit()
    return resume


# ---------------------------------------------------------------------------
# a. full legal-matrix port
# ---------------------------------------------------------------------------

_LEGAL_PAIRS = [
    (source, target)
    for source, targets in LEGAL_TRANSITIONS.items()
    for target in sorted(targets, key=lambda s: s.value)
]


@pytest.mark.parametrize(
    ("source", "target"),
    _LEGAL_PAIRS,
    ids=[f"{s.value}->{t.value}" for s, t in _LEGAL_PAIRS],
)
def test_legal_transition_full_matrix(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
    owned_resume: models.Resume,
    source: Stage,
    target: Stage,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage=source.value
    )
    payload: dict[str, object] = {"targetStage": target.value, "expectedVersion": 1}
    if target == Stage.applied:
        payload["resumeId"] = str(owned_resume.id)
    resp = db_client.post(f"{B}/applications/{app_row.id}/transitions", json=payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["application"]["stage"] == target.value
    assert body["application"]["version"] == 2
    assert body["transition"]["fromStage"] == source.value
    assert body["transition"]["toStage"] == target.value
    assert body["transition"]["source"] == "user"

    tr = db.exec(
        select(models.StageTransition).where(
            models.StageTransition.application_id == app_row.id
        )
    ).one()
    assert tr.from_stage == source.value
    assert tr.to_stage == target.value
    assert tr.seq == 1
    assert tr.source == "user"


# ---------------------------------------------------------------------------
# b. illegal edges rejected -- representative sample per source, no row born
# ---------------------------------------------------------------------------


def _one_illegal_target(source: Stage) -> Stage:
    allowed = LEGAL_TRANSITIONS[source]
    for candidate in LEGAL_TRANSITIONS:
        if candidate != source and candidate not in allowed:
            return candidate
    raise AssertionError("every stage has at least one illegal target")


_ILLEGAL_PAIRS = [(s, _one_illegal_target(s)) for s in LEGAL_TRANSITIONS]


@pytest.mark.parametrize(
    ("source", "target"),
    _ILLEGAL_PAIRS,
    ids=[f"{s.value}->{t.value}" for s, t in _ILLEGAL_PAIRS],
)
def test_illegal_transition_rejected_no_transition_row(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
    source: Stage,
    target: Stage,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage=source.value
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={"targetStage": target.value, "expectedVersion": 1},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["kind"] == "invalid_transition"
    assert (
        db.exec(
            select(models.StageTransition).where(
                models.StageTransition.application_id == app_row.id
            )
        ).first()
        is None
    )


# ---------------------------------------------------------------------------
# c. check order (mock parity)
# ---------------------------------------------------------------------------


def test_check_order_unknown_id_404(db_client: TestClient) -> None:
    resp = db_client.post(
        f"{B}/applications/{uuid.uuid4()}/transitions",
        json={"targetStage": "dismissed", "expectedVersion": 1},
    )
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_check_order_stale_version_409_conflict(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={"targetStage": "dismissed", "expectedVersion": 99},
    )
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"


def test_check_order_illegal_target_422_invalid_transition(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={"targetStage": "rejected", "expectedVersion": 1},
    )
    assert resp.status_code == 422
    assert resp.json()["kind"] == "invalid_transition"


def test_check_order_conflict_wins_over_illegal_target(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    """A stale expectedVersion AND an illegal target both hold -- 409 wins
    (the route checks version before legality, mock parity)."""
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={"targetStage": "rejected", "expectedVersion": 99},
    )
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"


def test_check_order_applied_without_resume_id_is_validation_error(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={"targetStage": "applied", "expectedVersion": 1},
    )
    assert resp.status_code == 422
    assert resp.json()["kind"] == "validation_error"


def test_check_order_applied_missing_vs_cross_tenant_resume_404_identical(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    intruder_resume = wire_resume_to_row(
        _wire_resume(name="Intruder Resume"), user_id=seed_domain.intruder.id
    )
    db.add(intruder_resume)
    db.commit()
    unknown = uuid.uuid4()
    cross = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={
            "targetStage": "applied",
            "expectedVersion": 1,
            "resumeId": str(intruder_resume.id),
        },
    )
    unk = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={"targetStage": "applied", "expectedVersion": 1, "resumeId": str(unknown)},
    )
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(intruder_resume.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


# ---------------------------------------------------------------------------
# d. AC-04a: zero-row abort before any child write
# ---------------------------------------------------------------------------


def test_stale_version_zero_row_abort_no_child_writes(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
    owned_resume: models.Resume,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={
            "targetStage": "applied",
            "expectedVersion": 99,
            "resumeId": str(owned_resume.id),
        },
    )
    assert resp.status_code == 409
    assert (
        db.exec(
            select(models.StageTransition).where(
                models.StageTransition.application_id == app_row.id
            )
        ).first()
        is None
    )
    assert (
        db.exec(
            select(models.ResumeSnapshot).where(
                models.ResumeSnapshot.application_id == app_row.id
            )
        ).first()
        is None
    )
    resume_row = db.get(models.Resume, owned_resume.id)
    assert resume_row is not None
    assert resume_row.used_in == 0


# ---------------------------------------------------------------------------
# e. AC-04c (PIN-2): induced APPLIED-atomicity failure rolls back everything
# ---------------------------------------------------------------------------


def test_applied_atomicity_induced_failure_rolls_back(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
    owned_resume: models.Resume,
) -> None:
    """Pre-insert a resume_snapshot row for the application (owner insert --
    append-only tables are only UPDATE/DELETE/TRUNCATE-locked, not
    INSERT-locked, for the table owner). Transitioning drafting->applied then
    makes the function's own snapshot INSERT collide with
    ``uq_resume_snapshot_application`` -- an IntegrityError the driver does
    NOT map (only EMP04/09/22/4A are mapped), so it propagates unhandled.
    Postgres statement-level atomicity means the guarded UPDATE the same
    statement already performed is rolled back too: no partial effects
    survive. This is the discriminating rollback proof for PIN-2/AC-04c."""
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    db.add(
        models.ResumeSnapshot(
            id=uuid.uuid4(),
            user_id=seed_domain.test_user.id,
            application_id=app_row.id,
            resume_id=owned_resume.id,
            name="pre-existing",
            body="pre-existing body",
            template_version="v1",
        )
    )
    db.commit()

    with pytest.raises(IntegrityError, match="uq_resume_snapshot_application"):
        db_client.post(
            f"{B}/applications/{app_row.id}/transitions",
            json={
                "targetStage": "applied",
                "expectedVersion": 1,
                "resumeId": str(owned_resume.id),
            },
        )
    db.rollback()

    refreshed = db.get(models.Application, app_row.id)
    assert refreshed is not None
    assert refreshed.stage == "drafting"
    assert refreshed.version == 1
    assert (
        db.exec(
            select(models.StageTransition).where(
                models.StageTransition.application_id == app_row.id
            )
        ).first()
        is None
    )
    resume_row = db.get(models.Resume, owned_resume.id)
    assert resume_row is not None
    assert resume_row.used_in == 0


# ---------------------------------------------------------------------------
# f. AC-04b: two-connection race (route level + deterministic SQL level)
# ---------------------------------------------------------------------------


def test_two_connection_route_race_exactly_one_winner() -> None:
    """Two CONCURRENT transitionApplication requests for the SAME application
    and SAME expectedVersion, two DIFFERENT legal targets (drafting->applied,
    drafting->dismissed), driven through the ROUTE on two threads sharing one
    TestClient -> EXACTLY one 2xx and one 409 (AC-04b). DB-asserted: exactly
    one new stage_transition row, version bumped by exactly one, and a
    snapshot row iff the winner was the applied thread -- no orphan child
    rows either way. Runs outside the rollback fixture on a THROWAWAY user
    (stage_transition/resume_snapshot are append-only -- even the owner
    cannot DELETE individual rows, so teardown goes through
    ``delete_user_with_history``, which cascades the whole tenant in one
    trigger-disabled transaction -- PIN-11)."""
    with Session(engine) as s:
        user = crud.create_user(
            session=s,
            user_create=UserCreate(
                email=random_email(), password=random_lower_string()
            ),
        )
        uid = user.id
        job = wire_job_to_row(_wire_job(company="RaceApp"), user_id=uid)
        s.add(job)
        resume = wire_resume_to_row(_wire_resume(name="RaceResume"), user_id=uid)
        s.add(resume)
        s.flush()
        app_row = models.Application(
            id=uuid.uuid4(), user_id=uid, job_id=job.id, stage="drafting", version=1
        )
        s.add(app_row)
        s.commit()
        resume_id, app_id = resume.id, app_row.id
        session_version = user.session_version

    token = security.create_access_token(
        uid,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        session_version=session_version,
    )
    headers = {"Authorization": f"Bearer {token}"}
    results: list[tuple[int, dict]] = []
    lock = threading.Lock()

    try:
        with TestClient(app) as c:
            c.headers.update(headers)

            def _attempt(target: str, resume_id_str: str | None) -> None:
                payload: dict[str, object] = {
                    "targetStage": target,
                    "expectedVersion": 1,
                }
                if resume_id_str is not None:
                    payload["resumeId"] = resume_id_str
                resp = c.post(f"{B}/applications/{app_id}/transitions", json=payload)
                with lock:
                    results.append((resp.status_code, resp.json()))

            t1 = threading.Thread(target=_attempt, args=("applied", str(resume_id)))
            t2 = threading.Thread(target=_attempt, args=("dismissed", None))
            t1.start()
            t2.start()
            t1.join(timeout=20)
            t2.join(timeout=20)

        statuses = sorted(r[0] for r in results)
        assert statuses == [200, 409], results
        winner = next(r for r in results if r[0] == 200)

        with Session(engine) as s:
            transitions = s.exec(
                select(models.StageTransition).where(
                    models.StageTransition.application_id == app_id
                )
            ).all()
            assert len(transitions) == 1
            refreshed = s.get(models.Application, app_id)
            assert refreshed is not None
            assert refreshed.version == 2
            snaps = s.exec(
                select(models.ResumeSnapshot).where(
                    models.ResumeSnapshot.application_id == app_id
                )
            ).all()
            if winner[1]["application"]["stage"] == "applied":
                assert len(snaps) == 1
            else:
                assert len(snaps) == 0
    finally:
        with Session(engine) as s:
            crud.delete_user_with_history(session=s, user_id=uid)
            s.commit()


def test_two_connection_sql_level_row_lock_serializes() -> None:
    """Deterministic two-connection proof the guarded UPDATE takes a real row
    lock (AC-04b): connection A calls ``application_stage_transition`` inside
    an OPEN transaction (no commit) -- the row lock is held. Connection B,
    under a short ``lock_timeout``, calls it for the SAME application WHILE A
    is still open -> B BLOCKS on the lock and raises (contention is real, not
    sequential). A then commits. Both connections SET LOCAL ROLE app_runtime
    + the GUC inside their own transactions (PIN-19); both are invalidate()d
    afterward so a pooled connection never leaks app_runtime onto a later
    owner-role test under FORCE RLS (PR-7, mirrors test_shortlist.py). A
    THROWAWAY user (see the route-race test above for why: append-only
    tables cannot be individually DELETEd, even by the owner)."""
    with Session(engine) as s:
        user = crud.create_user(
            session=s,
            user_create=UserCreate(
                email=random_email(), password=random_lower_string()
            ),
        )
        uid = user.id
        job = wire_job_to_row(_wire_job(company="RaceSql"), user_id=uid)
        s.add(job)
        s.flush()
        app_row = models.Application(
            id=uuid.uuid4(), user_id=uid, job_id=job.id, stage="drafting", version=1
        )
        s.add(app_row)
        s.commit()
        app_id = app_row.id

    conn_a = engine.connect()
    conn_b = engine.connect()
    try:
        for c in (conn_a, conn_b):
            c.execute(text("SET LOCAL ROLE app_runtime"))
            c.execute(
                text("SELECT set_config('app.user_id', :uid, true)"),
                {"uid": str(uid)},
            )

        def _call(c: object) -> None:
            c.execute(  # type: ignore[attr-defined]
                text(
                    "SELECT application_stage_transition("
                    " p_application_id => :aid, p_target_stage => 'dismissed',"
                    " p_allowed_from => ARRAY['drafting'],"
                    " p_expected_version => 1, p_source => 'user')"
                ),
                {"aid": app_id},
            )

        # A calls and holds its transaction OPEN (the row lock is live).
        _call(conn_a)
        # B, with a short lock_timeout, calls the SAME row while A is open ->
        # it BLOCKS on the row lock and times out: contention is real.
        conn_b.execute(text("SET LOCAL lock_timeout = '750ms'"))
        with pytest.raises(OperationalError):
            _call(conn_b)
        conn_b.rollback()
        conn_a.commit()  # the winner

        with Session(engine) as s:
            refreshed = s.get(models.Application, app_id)
            assert refreshed is not None
            assert refreshed.version == 2
            assert refreshed.stage == "dismissed"
    finally:
        for c in (conn_a, conn_b):
            try:
                c.invalidate()
            except Exception:  # noqa: BLE001 -- best-effort pool hygiene
                pass
            c.close()
        with Session(engine) as s:
            crud.delete_user_with_history(session=s, user_id=uid)
            s.commit()


# ---------------------------------------------------------------------------
# g. PIN-2 happy path: snapshot + resume lock, same transaction
# ---------------------------------------------------------------------------


def test_applied_effects_snapshot_and_resume_lock(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
    owned_resume: models.Resume,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={
            "targetStage": "applied",
            "expectedVersion": 1,
            "resumeId": str(owned_resume.id),
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    snap_id = body["application"]["submittedSnapshotId"]
    assert snap_id is not None
    assert body["transition"]["resumeId"] == str(owned_resume.id)

    snap_row = db.exec(
        select(models.ResumeSnapshot).where(
            models.ResumeSnapshot.application_id == app_row.id
        )
    ).one()
    assert str(snap_row.id) == snap_id
    assert snap_row.name == owned_resume.name
    assert snap_row.body == owned_resume.body

    resume_row = db.get(models.Resume, owned_resume.id)
    assert resume_row is not None
    assert resume_row.used_in == 1

    # The resume is now locked (RV-3): deleteResume 409s.
    delete_resp = db_client.delete(f"{B}/resumes/{owned_resume.id}")
    assert delete_resp.status_code == 409


def test_applied_snapshot_body_falls_back_when_resume_body_null(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    resume = wire_resume_to_row(
        _wire_resume(name="No Body", body=None), user_id=seed_domain.test_user.id
    )
    db.add(resume)
    db.commit()
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={
            "targetStage": "applied",
            "expectedVersion": 1,
            "resumeId": str(resume.id),
        },
    )
    assert resp.status_code == 200, resp.text
    snap_row = db.exec(
        select(models.ResumeSnapshot).where(
            models.ResumeSnapshot.application_id == app_row.id
        )
    ).one()
    assert snap_row.body == "Submitted resume -- locked at APPLIED."


# ---------------------------------------------------------------------------
# h. tenancy
# ---------------------------------------------------------------------------


def test_intruder_transition_404_indistinguishable(
    db: Session,
    intruder_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    unknown = uuid.uuid4()
    cross = intruder_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={"targetStage": "dismissed", "expectedVersion": 1},
    )
    unk = intruder_client.post(
        f"{B}/applications/{unknown}/transitions",
        json={"targetStage": "dismissed", "expectedVersion": 1},
    )
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(app_row.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )
    # The intruder's rejected attempt left no transition row an intruder (or
    # anyone) could later read via this op's own response surface.
    assert (
        db.exec(
            select(models.StageTransition).where(
                models.StageTransition.application_id == app_row.id
            )
        ).first()
        is None
    )


# ---------------------------------------------------------------------------
# i. getResumeSnapshot (DB)
# ---------------------------------------------------------------------------


def test_get_resume_snapshot_matches_submitted_id(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
    owned_resume: models.Resume,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={
            "targetStage": "applied",
            "expectedVersion": 1,
            "resumeId": str(owned_resume.id),
        },
    )
    assert resp.status_code == 200, resp.text
    submitted_id = resp.json()["application"]["submittedSnapshotId"]

    snap = db_client.get(f"{B}/applications/{app_row.id}/snapshot")
    assert snap.status_code == 200
    assert snap.json()["id"] == submitted_id


def test_get_resume_snapshot_conflict_before_applied(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id
    )
    resp = db_client.get(f"{B}/applications/{app_row.id}/snapshot")
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"
    assert resp.json()["message"] == (
        f"applications/{app_row.id}/snapshot: no submitted copy exists until "
        "the application reaches APPLIED."
    )


def test_get_resume_snapshot_unknown_404(db_client: TestClient) -> None:
    resp = db_client.get(f"{B}/applications/{uuid.uuid4()}/snapshot")
    assert resp.status_code == 404


def test_get_resume_snapshot_intruder_404_indistinguishable(
    db: Session,
    intruder_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
    owned_resume: models.Resume,
) -> None:
    """NOTE: builds the applied+snapshot state via direct DB inserts, not a
    db_client HTTP call -- db_client and intruder_client share ONE
    TestClient instance (fixtures mutate the same object's headers at setup
    time, in declaration order), so mixing them in one test would silently
    send the "db_client" request under the intruder's identity."""
    app_row = _insert_application(
        db,
        user_id=seed_domain.test_user.id,
        job_id=owned_job.id,
        resume_id=owned_resume.id,
        stage="applied",
    )
    db.add(
        models.ResumeSnapshot(
            id=uuid.uuid4(),
            user_id=seed_domain.test_user.id,
            application_id=app_row.id,
            resume_id=owned_resume.id,
            name=owned_resume.name,
            body=owned_resume.body or "Submitted resume -- locked at APPLIED.",
            template_version="v1",
        )
    )
    db.commit()
    unknown = uuid.uuid4()
    cross = intruder_client.get(f"{B}/applications/{app_row.id}/snapshot")
    unk = intruder_client.get(f"{B}/applications/{unknown}/snapshot")
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(app_row.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_get_resume_snapshot_synthesis_fallback_for_missing_row(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
    owned_resume: models.Resume,
) -> None:
    """A stage-past-drafting application with a resume_id but NO snapshot row
    is a runtime path that never legally crossed applied (a seed/test-fixture
    situation per PIN-15) -- the route falls back to the mock's deterministic
    read-only synthesis rather than 500ing."""
    app_row = _insert_application(
        db,
        user_id=seed_domain.test_user.id,
        job_id=owned_job.id,
        resume_id=owned_resume.id,
        stage="screening",
    )
    resp = db_client.get(f"{B}/applications/{app_row.id}/snapshot")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["id"] == str(uuid5(NAMESPACE_URL, f"mock:snapshot:{app_row.id}"))
    assert body["resumeId"] == str(owned_resume.id)
    assert body["applicationId"] == str(app_row.id)
