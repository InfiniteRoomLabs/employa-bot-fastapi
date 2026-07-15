"""DB-backed markWon/undoMarkWon/dismissApplication/reactivateApplication/
getApplicationTimeline coverage (sprint-04 3c, AC-06*/AC-07a/AC-08/AC-09).

The last 5 of the 20 PIN-6 flips (docs/sprints/sprint-04-spec.md). All five
drive the ONE stage-mutation function (``app.stage_flow.call_stage_transition``)
or its tiny soft-remove sibling exactly like ``transitionApplication`` (3b,
``tests/api/routes/test_transitions.py`` -- same fixture/helper conventions
duplicated locally per this repo's no-shared-test-fixture-across-files
practice).

Sections:

a. markWon happy path -- undo grant mint, transition row, version bump (PIN-12).
b. undoMarkWon -- round trip (PIN-3/AC-06a), expired window (AC-06b), unknown/
   foreign token (mock parity), two-connection double-undo race (AC-06c).
c. dismissApplication -- pre-commit soft-remove (PIN-14), post-APPLIED withdraw.
d. reactivateApplication -- clears outcome, resurrects, no snapshot duplication.
e. getApplicationTimeline -- derived from stage_transition (PIN-13), synthetic
   fallback, removed/unknown 404.
f. tenancy -- byte-identical 404s across all five ops (AC-08).
g. seed round-trip -- seed_demo_resumes/seed_demo_applications in-process.
"""

from __future__ import annotations

import threading
import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from uuid import NAMESPACE_URL, uuid5

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app import crud, models, schemas, store
from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.job_mapper import wire_job_to_row
from app.main import app
from app.models import User, UserCreate
from app.resume_mapper import wire_resume_to_row
from app.scripts.seed import seed_demo_applications, seed_demo_resumes, seed_demo_user
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
# a. markWon
# ---------------------------------------------------------------------------


def test_mark_won_happy(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="offer"
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/mark-won", json={"whatWorked": "great prep"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["application"]["outcome"] == "won"
    assert body["application"]["version"] == 2
    assert body["undoWindowSeconds"] == settings.UNDO_WINDOW_SECONDS
    assert body["undoToken"]
    assert body["undoExpiresAt"]

    tr = db.exec(
        select(models.StageTransition).where(
            models.StageTransition.application_id == app_row.id
        )
    ).one()
    assert tr.from_stage == "offer"
    assert tr.to_stage == "won"
    assert tr.source == "user"

    grant = db.exec(
        select(models.UndoGrant).where(models.UndoGrant.application_id == app_row.id)
    ).one()
    assert str(grant.id) == body["undoToken"]
    assert grant.corrects_transition_id == tr.id
    assert grant.consumed_at is None


def test_mark_won_from_a_second_active_stage(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    """markWon is legal from ANY active stage, not just offer (lc-verify
    finding 1): prove it from screening -- the route derives allowed_from
    from the live row, so a second stage discriminates generic handling
    from an offer-only special case."""
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="screening"
    )
    resp = db_client.post(f"{B}/applications/{app_row.id}/mark-won", json={})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["application"]["stage"] == "won"
    assert body["application"]["outcome"] == "won"
    tr = db.exec(
        select(models.StageTransition).where(
            models.StageTransition.application_id == app_row.id
        )
    ).one()
    assert tr.from_stage == "screening"
    assert tr.to_stage == "won"


def test_mark_won_unknown_404(db_client: TestClient) -> None:
    resp = db_client.post(f"{B}/applications/{uuid.uuid4()}/mark-won", json={})
    assert resp.status_code == 404


def test_mark_won_removed_row_404(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    """A soft-removed application (PIN-14) is dead to markWon too, and the
    404 is byte-identical to the unknown-id 404 (lc-verify finding 2)."""
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="drafting"
    )
    dismissed = db_client.post(f"{B}/applications/{app_row.id}/dismiss", json={})
    assert dismissed.status_code == 200
    removed = db_client.post(f"{B}/applications/{app_row.id}/mark-won", json={})
    unknown_id = uuid.uuid4()
    unknown = db_client.post(f"{B}/applications/{unknown_id}/mark-won", json={})
    assert removed.status_code == 404
    assert unknown.status_code == 404
    assert removed.text.replace(str(app_row.id), "<ID>") == unknown.text.replace(
        str(unknown_id), "<ID>"
    )


def test_mark_won_already_archived_404(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db,
        user_id=seed_domain.test_user.id,
        job_id=owned_job.id,
        stage="rejected",
        outcome="rejected",
    )
    resp = db_client.post(f"{B}/applications/{app_row.id}/mark-won", json={})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# b. undoMarkWon
# ---------------------------------------------------------------------------


def test_undo_round_trip(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="offer"
    )
    won = db_client.post(f"{B}/applications/{app_row.id}/mark-won", json={}).json()
    token = won["undoToken"]

    resp = db_client.post(
        f"{B}/applications/{app_row.id}/undo-mark-won", json={"undoToken": token}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["stage"] == "offer"
    assert body["outcome"] is None
    assert body["version"] == 3

    rows = db.exec(
        select(models.StageTransition)
        .where(models.StageTransition.application_id == app_row.id)
        .order_by(col(models.StageTransition.seq))
    ).all()
    assert len(rows) == 2
    won_tr, undo_tr = rows
    assert won_tr.to_stage == "won"  # the corrected row STILL present (PIN-3)
    assert undo_tr.source == "user_correction"
    assert undo_tr.corrects_transition_id == won_tr.id
    assert undo_tr.from_stage == "won"
    assert undo_tr.to_stage == "offer"

    grant = db.exec(
        select(models.UndoGrant).where(models.UndoGrant.application_id == app_row.id)
    ).one()
    assert grant.consumed_at is not None


def test_undo_expired_grant_409(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="offer"
    )
    token = db_client.post(f"{B}/applications/{app_row.id}/mark-won", json={}).json()[
        "undoToken"
    ]
    # Owner-session UPDATE of the grant's expiry into the past: append-only
    # (PIN-19) covers stage_transition/resume_snapshot, NOT undo_grant, and
    # only for app_runtime -- the owner test session can freely write it.
    grant = db.exec(
        select(models.UndoGrant).where(models.UndoGrant.id == uuid.UUID(token))
    ).one()
    grant.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.add(grant)
    db.commit()

    resp = db_client.post(
        f"{B}/applications/{app_row.id}/undo-mark-won", json={"undoToken": token}
    )
    assert resp.status_code == 409
    assert resp.json()["kind"] == "undo_window_expired"


def test_undo_unknown_and_foreign_token_404_identical(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="offer"
    )
    other_app = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="offer"
    )
    foreign_token = db_client.post(
        f"{B}/applications/{other_app.id}/mark-won", json={}
    ).json()["undoToken"]
    unknown_token = str(uuid.uuid4())

    unk = db_client.post(
        f"{B}/applications/{app_row.id}/undo-mark-won",
        json={"undoToken": unknown_token},
    )
    foreign = db_client.post(
        f"{B}/applications/{app_row.id}/undo-mark-won",
        json={"undoToken": foreign_token},
    )
    assert unk.status_code == foreign.status_code == 404
    assert unk.text.replace(unknown_token, "<TOK>") == foreign.text.replace(
        foreign_token, "<TOK>"
    )


def test_two_connection_double_undo_exactly_one_winner() -> None:
    """Two CONCURRENT undoMarkWon requests bearing the SAME token -> exactly
    one 2xx and one 409 (AC-06c). DB-asserted: ``consumed_at`` set exactly
    once, exactly one compensating (``user_correction``) transition row.
    Runs on a THROWAWAY user, outside the rollback fixture, mirroring
    ``test_transitions.py``'s route-race test: append-only histories cannot
    be individually deleted even by the owner, so teardown goes through
    ``delete_user_with_history`` (PIN-11)."""
    with Session(engine) as s:
        user = crud.create_user(
            session=s,
            user_create=UserCreate(
                email=random_email(), password=random_lower_string()
            ),
        )
        uid = user.id
        job = wire_job_to_row(_wire_job(company="UndoRace"), user_id=uid)
        s.add(job)
        s.flush()
        app_row = models.Application(
            id=uuid.uuid4(),
            user_id=uid,
            job_id=job.id,
            stage="won",
            version=2,
            outcome="won",
        )
        s.add(app_row)
        s.flush()
        won_tr = models.StageTransition(
            id=uuid.uuid4(),
            user_id=uid,
            application_id=app_row.id,
            seq=1,
            from_stage="offer",
            to_stage="won",
            source="user",
        )
        s.add(won_tr)
        s.flush()
        grant = models.UndoGrant(
            id=uuid.uuid4(),
            user_id=uid,
            application_id=app_row.id,
            corrects_transition_id=won_tr.id,
            expires_at=datetime.now(UTC) + timedelta(seconds=300),
        )
        s.add(grant)
        s.commit()
        app_id, token = app_row.id, grant.id
        session_version = user.session_version

    auth_token = security.create_access_token(
        uid,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        session_version=session_version,
    )
    headers = {"Authorization": f"Bearer {auth_token}"}
    results: list[tuple[int, dict[str, object]]] = []
    lock = threading.Lock()

    try:
        with TestClient(app) as c:
            c.headers.update(headers)

            def _attempt() -> None:
                resp = c.post(
                    f"{B}/applications/{app_id}/undo-mark-won",
                    json={"undoToken": str(token)},
                )
                with lock:
                    results.append((resp.status_code, resp.json()))

            t1 = threading.Thread(target=_attempt)
            t2 = threading.Thread(target=_attempt)
            t1.start()
            t2.start()
            t1.join(timeout=20)
            t2.join(timeout=20)

        statuses = sorted(r[0] for r in results)
        assert statuses == [200, 409], results

        with Session(engine) as s:
            grant_row = s.get(models.UndoGrant, token)
            assert grant_row is not None
            assert grant_row.consumed_at is not None
            corrections = s.exec(
                select(models.StageTransition).where(
                    models.StageTransition.application_id == app_id,
                    models.StageTransition.source == "user_correction",
                )
            ).all()
            assert len(corrections) == 1
    finally:
        with Session(engine) as s:
            crud.delete_user_with_history(session=s, user_id=uid)
            s.commit()


# ---------------------------------------------------------------------------
# c. dismissApplication (D12 dual-mode)
# ---------------------------------------------------------------------------


def test_dismiss_pre_commit_soft_removes(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="drafting"
    )
    resp = db_client.post(f"{B}/applications/{app_row.id}/dismiss", json={})
    assert resp.status_code == 200, resp.text
    assert resp.json()["outcome"] == "removed"

    row = db.get(models.Application, app_row.id)
    assert row is not None
    assert row.removed_at is not None

    assert db_client.get(f"{B}/applications/{app_row.id}").status_code == 404
    ids = {a["id"] for a in db_client.get(f"{B}/applications").json()}
    assert str(app_row.id) not in ids
    assert db_client.get(f"{B}/applications/{app_row.id}/timeline").status_code == 404

    again = db_client.post(f"{B}/applications/{app_row.id}/dismiss", json={})
    assert again.status_code == 404


def test_dismiss_post_applied_withdraws_and_archives(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="screening"
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/dismiss",
        json={"reasons": ["comp", "location"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["outcome"] == "withdrew"

    row = db.get(models.Application, app_row.id)
    assert row is not None
    assert row.stage == "withdrew"
    assert row.outcome == "withdrawn"
    assert row.outcome_reasons == ["comp", "location"]
    assert row.version == 2

    archived = db_client.get(f"{B}/archive", params={"kind": "passed"})
    assert str(app_row.id) in {a["id"] for a in archived.json()}


def test_dismiss_unknown_404(db_client: TestClient) -> None:
    resp = db_client.post(f"{B}/applications/{uuid.uuid4()}/dismiss", json={})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# d. reactivateApplication (D19)
# ---------------------------------------------------------------------------


def test_reactivate_clears_outcome_and_resurrects(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
    owned_resume: models.Resume,
) -> None:
    app_row = _insert_application(
        db,
        user_id=seed_domain.test_user.id,
        job_id=owned_job.id,
        resume_id=owned_resume.id,
        stage="rejected",
        outcome="rejected",
    )
    # A reactivated application already owns a snapshot from its original
    # applied transition (PIN-15) -- seed one directly (owner insert).
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

    resp = db_client.post(f"{B}/applications/{app_row.id}/reactivate")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["stage"] == "applied"
    assert body["resurrected"] is True
    assert body["outcome"] is None
    assert body["version"] == 2

    tr = db.exec(
        select(models.StageTransition).where(
            models.StageTransition.application_id == app_row.id
        )
    ).one()
    assert tr.source == "user_reactivation"
    assert tr.to_stage == "applied"

    snaps = db.exec(
        select(models.ResumeSnapshot).where(
            models.ResumeSnapshot.application_id == app_row.id
        )
    ).all()
    assert len(snaps) == 1  # NOT duplicated


def test_reactivate_non_archived_404(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="screening"
    )
    resp = db_client.post(f"{B}/applications/{app_row.id}/reactivate")
    assert resp.status_code == 404


def test_reactivate_unknown_404(db_client: TestClient) -> None:
    resp = db_client.post(f"{B}/applications/{uuid.uuid4()}/reactivate")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# e. getApplicationTimeline (PIN-13)
# ---------------------------------------------------------------------------


def test_timeline_derived_from_transitions(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="drafting"
    )
    resp = db_client.post(
        f"{B}/applications/{app_row.id}/transitions",
        json={"targetStage": "dismissed", "expectedVersion": 1},
    )
    assert resp.status_code == 200, resp.text
    transition_id = resp.json()["transition"]["id"]

    timeline = db_client.get(f"{B}/applications/{app_row.id}/timeline")
    assert timeline.status_code == 200
    events = timeline.json()
    assert len(events) == 1
    assert events[0]["id"] == transition_id
    assert events[0]["message"] == "Moved to dismissed"
    assert events[0]["who"] == "You"


def test_timeline_synthetic_fallback_zero_transitions(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="drafting"
    )
    resp = db_client.get(f"{B}/applications/{app_row.id}/timeline")
    assert resp.status_code == 200
    events = resp.json()
    assert len(events) == 1
    assert events[0]["message"].startswith("Applied via")
    assert events[0]["id"] == str(
        uuid5(NAMESPACE_URL, f"mock:timeline-synth:{app_row.id}")
    )


def test_timeline_removed_app_404(
    db: Session, db_client: TestClient, seed_domain: SeededUsers, owned_job: models.Job
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="drafting"
    )
    db_client.post(f"{B}/applications/{app_row.id}/dismiss", json={})
    resp = db_client.get(f"{B}/applications/{app_row.id}/timeline")
    assert resp.status_code == 404


def test_timeline_unknown_404(db_client: TestClient) -> None:
    resp = db_client.get(f"{B}/applications/{uuid.uuid4()}/timeline")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# f. tenancy -- byte-identical 404s across all five new ops (AC-08)
# ---------------------------------------------------------------------------


def test_intruder_mark_won_404_identical(
    db: Session,
    intruder_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="offer"
    )
    unknown = uuid.uuid4()
    cross = intruder_client.post(f"{B}/applications/{app_row.id}/mark-won", json={})
    unk = intruder_client.post(f"{B}/applications/{unknown}/mark-won", json={})
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(app_row.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_intruder_undo_mark_won_404_identical(
    db: Session,
    intruder_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    """Built via direct DB inserts (owner session), not a ``db_client`` HTTP
    call: ``db_client``/``intruder_client`` share ONE TestClient (fixture-
    order header mutation), so mixing them in one test silently sends the
    "db_client" request under the intruder's identity."""
    app_row = _insert_application(
        db,
        user_id=seed_domain.test_user.id,
        job_id=owned_job.id,
        stage="won",
        version=2,
        outcome="won",
    )
    won_tr = models.StageTransition(
        id=uuid.uuid4(),
        user_id=seed_domain.test_user.id,
        application_id=app_row.id,
        seq=1,
        from_stage="offer",
        to_stage="won",
        source="user",
    )
    db.add(won_tr)
    db.flush()
    grant = models.UndoGrant(
        id=uuid.uuid4(),
        user_id=seed_domain.test_user.id,
        application_id=app_row.id,
        corrects_transition_id=won_tr.id,
        expires_at=datetime.now(UTC) + timedelta(seconds=300),
    )
    db.add(grant)
    db.commit()

    unknown_token = uuid.uuid4()
    cross = intruder_client.post(
        f"{B}/applications/{app_row.id}/undo-mark-won",
        json={"undoToken": str(grant.id)},
    )
    unk = intruder_client.post(
        f"{B}/applications/{app_row.id}/undo-mark-won",
        json={"undoToken": str(unknown_token)},
    )
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(grant.id), "<TOK>") == unk.text.replace(
        str(unknown_token), "<TOK>"
    )


def test_intruder_dismiss_404_identical(
    db: Session,
    intruder_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="drafting"
    )
    unknown = uuid.uuid4()
    cross = intruder_client.post(f"{B}/applications/{app_row.id}/dismiss", json={})
    unk = intruder_client.post(f"{B}/applications/{unknown}/dismiss", json={})
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(app_row.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_intruder_reactivate_404_identical(
    db: Session,
    intruder_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db,
        user_id=seed_domain.test_user.id,
        job_id=owned_job.id,
        stage="rejected",
        outcome="rejected",
    )
    unknown = uuid.uuid4()
    cross = intruder_client.post(f"{B}/applications/{app_row.id}/reactivate")
    unk = intruder_client.post(f"{B}/applications/{unknown}/reactivate")
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(app_row.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


def test_intruder_timeline_404_identical(
    db: Session,
    intruder_client: TestClient,
    seed_domain: SeededUsers,
    owned_job: models.Job,
) -> None:
    app_row = _insert_application(
        db, user_id=seed_domain.test_user.id, job_id=owned_job.id, stage="drafting"
    )
    unknown = uuid.uuid4()
    cross = intruder_client.get(f"{B}/applications/{app_row.id}/timeline")
    unk = intruder_client.get(f"{B}/applications/{unknown}/timeline")
    assert cross.status_code == unk.status_code == 404
    assert cross.text.replace(str(app_row.id), "<ID>") == unk.text.replace(
        str(unknown), "<ID>"
    )


# ---------------------------------------------------------------------------
# g. seed round-trip
# ---------------------------------------------------------------------------


def _delete_demo_user() -> None:
    with Session(engine) as session:
        demo = session.exec(
            select(User).where(User.email == settings.SEED_DEMO_EMAIL)
        ).first()
        if demo is not None:
            crud.delete_user_with_history(session=session, user_id=demo.id)
        session.commit()


@pytest.fixture()
def clean_demo_slate() -> Generator[None]:
    """No demo user before the test; none left behind after. Bootstrap-tier,
    own committed sessions -- duplicated locally from
    ``tests/scripts/test_seed.py``'s fixture of the same name (no
    shared-fixture-across-files convention in this repo)."""
    _delete_demo_user()
    yield
    _delete_demo_user()


@pytest.mark.usefixtures("clean_demo_slate")
def test_seed_demo_applications_round_trip() -> None:
    """``seed_demo_resumes``/``seed_demo_applications`` in-process: the seven
    slug-keyed fixture applications land as real rows with a consistent-seq
    canonical-path history, and a resume_snapshot for every row past
    drafting (PIN-15). Re-running without ``--reset`` is an all-or-nothing
    no-op (upsert-skip)."""
    with Session(engine) as session:
        user = seed_demo_user(session)
        demo_user_id = user.id
        seed_demo_resumes(session, user)
        created = seed_demo_applications(session, user)
    assert created == len(store.APP_UUID_BY_SLUG)

    with Session(engine) as session:
        for app_id in store.APP_UUID_BY_SLUG.values():
            row = session.get(models.Application, app_id)
            assert row is not None
            assert row.user_id == demo_user_id

            transitions = session.exec(
                select(models.StageTransition)
                .where(models.StageTransition.application_id == app_id)
                .order_by(col(models.StageTransition.seq))
            ).all()
            assert [t.seq for t in transitions] == list(range(1, len(transitions) + 1))
            assert transitions  # every fixture app passed through applied

            if row.stage != "drafting":
                snap = session.exec(
                    select(models.ResumeSnapshot).where(
                        models.ResumeSnapshot.application_id == app_id
                    )
                ).first()
                assert snap is not None, f"{app_id}: PIN-15 -- missing snapshot"

    # Idempotent re-run (non-reset): all-or-nothing skip, 0 created.
    with Session(engine) as session:
        user2 = seed_demo_user(session)
        again = seed_demo_applications(session, user2)
    assert again == 0
