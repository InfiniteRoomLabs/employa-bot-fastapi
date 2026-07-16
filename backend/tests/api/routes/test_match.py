"""DB-backed match/scoring coverage (sprint-05, AC-03/04/05b/06/06b/08/10/12).

Fidelity: runDeepMatchScore persists a run + report and serves the
deterministic fake score with a real AiRunEnvelope; getMatchReport serves
the CURRENT version from real rows. Purity (AC-04): previewDeepMatchScore
never constructs a provider and writes nothing. Reservation flow: cap 402
before any spend, provider-failure release (AC-06b), retry-after-failure
adoption with no double charge (AC-06), reservation committed BEFORE the
provider call (AC-05b, real-commit world). Tenancy (AC-08): the enumerated
op x vector matrix, tenant-indistinguishable 404s, budget isolation.
Throttle (AC-10) and the 402/429/503 envelopes (AC-12). Provenance
(PIN-A16): store-only fixture not served; DB-only rows are.
"""

from __future__ import annotations

import threading
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text as sa_text
from sqlmodel import Session, select

from app import models, schemas, store
from app.ai.base import AiProvider, DeepMatchInput, DeepMatchOutcome
from app.api.routes import match as match_module
from app.core.config import settings
from app.core.db import engine
from app.job_mapper import wire_job_to_row
from app.main import app
from tests.conftest import SeededUsers, _bearer_for

B = "/api/v1"
UNKNOWN = uuid.UUID("00000000-0000-4000-8000-000000000000")


def _wire_job(
    company: str = "Probe Co", match: dict[str, Any] | None = None
) -> schemas.Job:
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
            "match": match,
        }
    )


BASELINE = {
    "score": 92,
    "strengths": ["Distributed systems depth", "Payments-adjacent work"],
    "gaps": ["No direct fintech compliance exposure"],
    "kind": "rough",
}


def _mk_pair(
    db: Session, user_id: uuid.UUID, *, baseline: dict[str, Any] | None = BASELINE
) -> tuple[uuid.UUID, uuid.UUID]:
    """One owned job (+optional match baseline) and one owned resume."""
    job = wire_job_to_row(_wire_job(match=baseline), user_id=user_id)
    resume = models.Resume(
        user_id=user_id,
        name="Probe Resume",
        subtitle="sub",
        version="v1",
        used_in=0,
        tag="DRAFT",
    )
    db.add(job)
    db.add(resume)
    db.commit()
    return job.id, resume.id


def _mk_budget(
    db: Session,
    user_id: uuid.UUID,
    *,
    spent: str = "0",
    cap: str = "20.00",
) -> models.UserAiBudget:
    row = models.UserAiBudget(
        user_id=user_id,
        month_start=datetime.now(UTC).date().replace(day=1),
        cap_usd=Decimal(cap),
        spent_usd=Decimal(spent),
    )
    db.add(row)
    db.commit()
    return row


def _mk_report(
    db: Session,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    resume_id: uuid.UUID,
    *,
    score: int = 88,
    version: int = 1,
    budget: models.UserAiBudget | None = None,
) -> models.MatchReport:
    """Materialize a settled run + report directly (owner inserts -- the
    test engine is superuser, RLS/append-only INSERT both permit this)."""
    if budget is None:
        budget = _mk_budget(db, user_id)
    run = models.AiRun(
        user_id=user_id,
        job_id=job_id,
        resume_id=resume_id,
        budget_id=budget.id,
        kind="deep_match_score",
        provider="fake",
        model="gemini-1.5-pro",
        reserved_max_usd=Decimal("0.14"),
        idempotency_key=f"deep_match_score:{job_id}:{resume_id}:{version - 1}",
    )
    db.add(run)
    db.commit()
    for kind, cost in (("reserved", None), ("succeeded", Decimal("0.14"))):
        db.add(
            models.AiRunEvent(
                user_id=user_id, run_id=run.id, kind=kind, actual_cost_usd=cost
            )
        )
    report = models.MatchReport(
        user_id=user_id,
        job_id=job_id,
        resume_id=resume_id,
        ai_run_id=run.id,
        version=version,
        score=score,
        rubric=[{"label": "Skills", "score": 9, "note": "n"}],
        gaps=[{"severity": "low", "text": "g"}],
        strengths=["s1"],
    )
    db.add(report)
    db.commit()
    return report


def _runs_for(db: Session, user_id: uuid.UUID) -> list[models.AiRun]:
    return list(
        db.exec(select(models.AiRun).where(models.AiRun.user_id == user_id)).all()
    )


def _budget_of(db: Session, user_id: uuid.UUID) -> tuple[Decimal, Decimal] | None:
    row = db.exec(
        select(models.UserAiBudget).where(models.UserAiBudget.user_id == user_id)
    ).first()
    if row is None:
        return None
    db.refresh(row)
    return (row.spent_usd, row.reserved_usd)


# ------------------------------------------------------------- fidelity


def test_run_deep_match_score_persists_and_serves_report(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    """AC-03/AC-06b: the full reservation flow -- run row + reserved/succeeded
    events + report v1 + exact budget conversion + the wire envelope."""
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)

    resp = db_client.post(
        f"{B}/jobs/{job_id}/deep-score", json={"resumeId": str(resume_id)}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["score"] == 95  # min(99, 92 + 3), PIN-A8
    assert body["kind"] == "deep"
    assert body["costUsd"] == 0.14
    assert body["strengths"] == BASELINE["strengths"]
    assert body["gaps"] == BASELINE["gaps"]
    env = body["aiRun"]
    assert env["provider"] == "fake"
    assert env["model"] == "gemini-1.5-pro"
    assert env["status"] == "succeeded"
    assert env["synthetic"] is True
    assert env["estimatedCostUsd"] == 0.14
    assert env["actualCostUsd"] == 0.14
    assert env["durationMs"] >= 0

    # DB state: one run, reserved + succeeded events, budget converted
    runs = _runs_for(db, user.id)
    assert len(runs) == 1
    kinds = {
        e.kind
        for e in db.exec(
            select(models.AiRunEvent).where(models.AiRunEvent.run_id == runs[0].id)
        ).all()
    }
    assert kinds == {"reserved", "succeeded"}
    assert _budget_of(db, user.id) == (Decimal("0.14"), Decimal("0"))

    # the report reads back through the implemented read op (D1-5/D1-6)
    report = db_client.get(
        f"{B}/match-report",
        params={"resumeId": str(resume_id), "jobId": str(job_id)},
    )
    assert report.status_code == 200
    rbody = report.json()
    assert rbody["score"] == 95
    assert rbody["resumeId"] == str(resume_id)
    assert rbody["jobId"] == str(job_id)
    assert len(rbody["rubric"]) == 4
    assert rbody["strengths"] == BASELINE["strengths"]


def test_run_without_baseline_scores_80(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    job_id, resume_id = _mk_pair(db, seed_domain.test_user.id, baseline=None)
    resp = db_client.post(
        f"{B}/jobs/{job_id}/deep-score", json={"resumeId": str(resume_id)}
    )
    assert resp.status_code == 200
    assert resp.json()["score"] == 80


def test_get_match_report_serves_current_version(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    """PIN-A7: MAX(version) wins."""
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)
    budget = _mk_budget(db, user.id)
    _mk_report(db, user.id, job_id, resume_id, score=88, version=1, budget=budget)
    _mk_report(db, user.id, job_id, resume_id, score=95, version=2, budget=budget)
    resp = db_client.get(
        f"{B}/match-report",
        params={"resumeId": str(resume_id), "jobId": str(job_id)},
    )
    assert resp.status_code == 200
    assert resp.json()["score"] == 95


def test_get_match_report_unscored_pair_404(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    job_id, resume_id = _mk_pair(db, seed_domain.test_user.id)
    resp = db_client.get(
        f"{B}/match-report",
        params={"resumeId": str(resume_id), "jobId": str(job_id)},
    )
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_store_fixture_not_served(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PIN-A16 provenance: mutating the mock fixture does not move the
    DB-served report."""
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)
    _mk_report(db, user.id, job_id, resume_id, score=88)
    monkeypatch.setattr(store, "MATCH_REPORT_SCORE", 55)
    resp = db_client.get(
        f"{B}/match-report",
        params={"resumeId": str(resume_id), "jobId": str(job_id)},
    )
    assert resp.status_code == 200
    assert resp.json()["score"] == 88


# ------------------------------------------------------------- preview (AC-04)


def test_preview_is_pure_arithmetic_no_provider_no_rows(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-04: no provider construction, no ai_run row, default cap when no
    budget row exists (and the read creates none)."""
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)

    def _bomb(_settings: object) -> AiProvider:
        raise AssertionError("previewDeepMatchScore constructed a provider")

    monkeypatch.setattr(match_module, "get_provider", _bomb)
    resp = db_client.post(
        f"{B}/jobs/{job_id}/preview-deep-score",
        json={"resumeIds": [str(resume_id)]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["items"] == [
        {
            "resumeId": str(resume_id),
            "model": "gemini-1.5-pro",
            "estCostUsd": 0.14,
        }
    ]
    assert body["totalUsd"] == 0.14
    assert body["capRemainingUsd"] == 20.0
    assert body["overCap"] is False
    assert _runs_for(db, user.id) == []
    assert _budget_of(db, user.id) is None


def test_preview_reads_budget_row_mock_parity(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)
    _mk_budget(db, user.id, spent="3.42")
    resp = db_client.post(
        f"{B}/jobs/{job_id}/preview-deep-score",
        json={"resumeIds": [str(resume_id)]},
    )
    assert resp.json()["capRemainingUsd"] == 16.58  # the mock's exact value


def test_preview_over_cap_boundary(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)
    _mk_budget(db, user.id, spent="19.90")
    resp = db_client.post(
        f"{B}/jobs/{job_id}/preview-deep-score",
        json={"resumeIds": [str(resume_id)]},
    )
    body = resp.json()
    assert body["capRemainingUsd"] == 0.10
    assert body["overCap"] is True


# ------------------------------------------------------------- envelopes


def test_run_cap_reached_402_before_any_spend(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    """AC-12: 402 cap_reached; nothing reserved, nothing inserted."""
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)
    _mk_budget(db, user.id, spent="19.90")
    resp = db_client.post(
        f"{B}/jobs/{job_id}/deep-score", json={"resumeId": str(resume_id)}
    )
    assert resp.status_code == 402
    assert resp.json()["kind"] == "cap_reached"
    assert _runs_for(db, user.id) == []
    assert _budget_of(db, user.id) == (Decimal("19.90"), Decimal("0"))


def test_run_throttle_429(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-10: the per-user window 429s BEFORE any budget work."""
    monkeypatch.setattr(settings, "DEEP_SCORE_THROTTLE_USER_PER_MINUTE", 1)
    first = db_client.post(
        f"{B}/jobs/{UNKNOWN}/deep-score", json={"resumeId": str(UNKNOWN)}
    )
    assert first.status_code == 404  # consumed the window on a 404
    second = db_client.post(
        f"{B}/jobs/{UNKNOWN}/deep-score", json={"resumeId": str(UNKNOWN)}
    )
    assert second.status_code == 429
    assert second.json()["kind"] == "rate_limited"


def test_run_provider_unavailable_releases_reservation(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-06b/AC-12: explicit-only factory failure -> failed settlement
    (reservation fully released) -> 503 provider_unavailable; the seam
    stays live for the next request."""
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)
    monkeypatch.setattr(settings, "AI_PROVIDER", "claude_cli")
    resp = db_client.post(
        f"{B}/jobs/{job_id}/deep-score", json={"resumeId": str(resume_id)}
    )
    assert resp.status_code == 503
    assert resp.json()["kind"] == "provider_unavailable"
    runs = _runs_for(db, user.id)
    assert len(runs) == 1  # the reservation was made, then settled failed
    kinds = {
        e.kind
        for e in db.exec(
            select(models.AiRunEvent).where(models.AiRunEvent.run_id == runs[0].id)
        ).all()
    }
    assert kinds == {"reserved", "failed"}
    assert _budget_of(db, user.id) == (Decimal("0"), Decimal("0"))

    # liveness: restore the provider; the next run succeeds as a NEW run
    monkeypatch.setattr(settings, "AI_PROVIDER", "fake")
    retry = db_client.post(
        f"{B}/jobs/{job_id}/deep-score", json={"resumeId": str(resume_id)}
    )
    assert retry.status_code == 200
    assert _budget_of(db, user.id) == (Decimal("0.14"), Decimal("0"))


def test_run_retry_after_post_reservation_failure_no_double_charge(
    db: Session,
    db_client: TestClient,
    seed_domain: SeededUsers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-06 route-level: a crash between reserve-commit and settle leaves an
    open run; the retry ADOPTS it, re-invokes the deterministic provider
    (invocation counter), settles once -- one run, one charge."""
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)

    calls = {"provider": 0, "settle": 0}
    real_settle = match_module.call_ai_settle
    real_get_provider = match_module.get_provider

    def counting_provider(settings_obj: object) -> AiProvider:
        inner = real_get_provider(settings_obj)  # type: ignore[arg-type]
        real_score = inner.deep_match_score

        def counted(request: DeepMatchInput) -> DeepMatchOutcome:
            calls["provider"] += 1
            return real_score(request)

        inner.deep_match_score = counted  # type: ignore[method-assign]
        return inner

    def crashing_settle(*args: Any, **kwargs: Any) -> dict[str, Any]:
        calls["settle"] += 1
        if calls["settle"] == 1:
            raise RuntimeError("simulated crash after provider, before settle")
        return real_settle(*args, **kwargs)

    monkeypatch.setattr(match_module, "get_provider", counting_provider)
    monkeypatch.setattr(match_module, "call_ai_settle", crashing_settle)

    with pytest.raises(RuntimeError, match="simulated crash"):
        db_client.post(
            f"{B}/jobs/{job_id}/deep-score", json={"resumeId": str(resume_id)}
        )
    # the reservation committed before the crash; the run is open
    assert _budget_of(db, user.id) == (Decimal("0"), Decimal("0.14"))
    assert len(_runs_for(db, user.id)) == 1

    retry = db_client.post(
        f"{B}/jobs/{job_id}/deep-score", json={"resumeId": str(resume_id)}
    )
    assert retry.status_code == 200, retry.text
    assert retry.json()["score"] == 95
    # adopted, not re-reserved: ONE run, ONE charge, provider re-invoked
    # deterministically (PIN-A4 iii)
    assert len(_runs_for(db, user.id)) == 1
    assert _budget_of(db, user.id) == (Decimal("0.14"), Decimal("0"))
    assert calls["provider"] == 2
    assert calls["settle"] == 2


# ------------------------------------------------------------- AC-05b


class _BlockingProvider(AiProvider):
    name = "fake"
    synthetic = True

    def __init__(self) -> None:
        self.entered = threading.Event()
        self.release = threading.Event()

    def deep_match_score(self, request: DeepMatchInput) -> DeepMatchOutcome:
        self.entered.set()
        assert self.release.wait(timeout=10), "test never released the provider"
        return DeepMatchOutcome(
            score=80,
            strengths=["s"],
            gaps=[{"severity": "medium", "text": "g"}],
            rubric=[{"label": "Skills", "score": 8, "note": "n"}],
            actual_cost_usd=request.unit_cost_usd,
        )


def test_reservation_commits_before_provider_call(
    seed_domain: SeededUsers, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-05b (D1-4): while the provider is BLOCKED mid-call, a second
    connection observes the COMMITTED reservation and is not lock-blocked --
    the provider runs outside any transaction. Real-commit world with a
    throwaway tenant, torn down via delete_user_with_history."""
    from app import crud
    from app.models import UserCreate

    email = f"ac05b-{uuid.uuid4()}@example.com"
    with Session(engine) as setup:
        user = crud.create_user(
            session=setup,
            user_create=UserCreate(email=email, password="ac05b-pass-123"),
        )
        user_id = user.id
        job_id, resume_id = _mk_pair(setup, user_id)

    provider = _BlockingProvider()
    monkeypatch.setattr(match_module, "get_provider", lambda _s: provider)

    result: dict[str, Any] = {}

    def _call() -> None:
        with TestClient(app) as real_client:
            real_client.headers.update(_bearer_for_user_id(user_id, email))
            result["response"] = real_client.post(
                f"{B}/jobs/{job_id}/deep-score",
                json={"resumeId": str(resume_id)},
            )

    thread = threading.Thread(target=_call)
    try:
        thread.start()
        assert provider.entered.wait(timeout=10), "provider was never invoked"
        # second connection: the reservation is COMMITTED and readable with
        # a tiny lock_timeout -- nothing is holding the budget row
        with engine.connect() as probe:
            probe.execute(sa_text("SET LOCAL lock_timeout = '250ms'"))
            reserved = probe.execute(
                sa_text(
                    "SELECT reserved_usd FROM user_ai_budget"
                    " WHERE user_id = :uid FOR UPDATE"
                ),
                {"uid": user_id},
            ).scalar_one()
            assert reserved == Decimal("0.14")
            probe.rollback()
    finally:
        provider.release.set()
        thread.join(timeout=30)

    assert result["response"].status_code == 200, result["response"].text
    with engine.connect() as verify:
        spent, reserved = verify.execute(
            sa_text(
                "SELECT spent_usd, reserved_usd FROM user_ai_budget"
                " WHERE user_id = :uid"
            ),
            {"uid": user_id},
        ).one()
        assert (spent, reserved) == (Decimal("0.14"), Decimal("0"))
        verify.execute(
            sa_text("SELECT delete_user_with_history(:uid)"), {"uid": user_id}
        )
        verify.commit()


def _bearer_for_user_id(user_id: uuid.UUID, email: str) -> dict[str, str]:
    with Session(engine) as s:
        user = s.exec(
            select(models.User).where(models.User.id == user_id)
        ).one()
        return _bearer_for(user)


# ------------------------------------------------------------- AC-08 tenancy
# PR-10: one acting client (intruder); the victim's state is direct inserts.


def _victim_world(
    db: Session, seed_domain: SeededUsers
) -> tuple[uuid.UUID, uuid.UUID]:
    """Victim rows (job+resume+budget+run+report) owned by test_user."""
    victim = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, victim.id)
    budget = _mk_budget(db, victim.id, spent="15.00")
    _mk_report(db, victim.id, job_id, resume_id, score=88, budget=budget)
    return job_id, resume_id


def test_get_match_report_cross_tenant_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    job_id, resume_id = _victim_world(db, seed_domain)
    foreign = intruder_client.get(
        f"{B}/match-report",
        params={"resumeId": str(resume_id), "jobId": str(job_id)},
    )
    unknown = intruder_client.get(
        f"{B}/match-report",
        params={"resumeId": str(UNKNOWN), "jobId": str(UNKNOWN)},
    )
    assert foreign.status_code == unknown.status_code == 404
    foreign_body = foreign.json()
    unknown_body = unknown.json()
    assert foreign_body["kind"] == unknown_body["kind"] == "not_found"
    # byte-identical shape up to the echoed request ids
    assert set(foreign_body) == set(unknown_body)


@pytest.mark.parametrize("vector", ["victim_resume", "victim_job"])
def test_get_match_report_mixed_vectors_404(
    db: Session,
    intruder_client: TestClient,
    seed_domain: SeededUsers,
    vector: str,
) -> None:
    """Foreign resumeId with own jobId (and vice versa) are still 404."""
    v_job, v_resume = _victim_world(db, seed_domain)
    own_job, own_resume = _mk_pair(db, seed_domain.intruder.id)
    params = (
        {"resumeId": str(v_resume), "jobId": str(own_job)}
        if vector == "victim_resume"
        else {"resumeId": str(own_resume), "jobId": str(v_job)}
    )
    resp = intruder_client.get(f"{B}/match-report", params=params)
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_preview_cross_tenant_job_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    v_job, _ = _victim_world(db, seed_domain)
    _, own_resume = _mk_pair(db, seed_domain.intruder.id)
    foreign = intruder_client.post(
        f"{B}/jobs/{v_job}/preview-deep-score",
        json={"resumeIds": [str(own_resume)]},
    )
    unknown = intruder_client.post(
        f"{B}/jobs/{UNKNOWN}/preview-deep-score",
        json={"resumeIds": [str(own_resume)]},
    )
    assert foreign.status_code == unknown.status_code == 404
    assert foreign.json()["kind"] == unknown.json()["kind"] == "not_found"


def test_preview_foreign_resume_id_in_body_404_indistinguishable(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    _, v_resume = _victim_world(db, seed_domain)
    own_job, _ = _mk_pair(db, seed_domain.intruder.id)
    foreign = intruder_client.post(
        f"{B}/jobs/{own_job}/preview-deep-score",
        json={"resumeIds": [str(v_resume)]},
    )
    unknown = intruder_client.post(
        f"{B}/jobs/{own_job}/preview-deep-score",
        json={"resumeIds": [str(UNKNOWN)]},
    )
    assert foreign.status_code == unknown.status_code == 404
    assert foreign.json()["kind"] == unknown.json()["kind"] == "not_found"


def test_run_cross_tenant_job_404_and_no_run_created(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    v_job, _ = _victim_world(db, seed_domain)
    _, own_resume = _mk_pair(db, seed_domain.intruder.id)
    resp = intruder_client.post(
        f"{B}/jobs/{v_job}/deep-score", json={"resumeId": str(own_resume)}
    )
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"
    assert _runs_for(db, seed_domain.intruder.id) == []


def test_run_foreign_resume_id_404_and_no_run_created(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    _, v_resume = _victim_world(db, seed_domain)
    own_job, _ = _mk_pair(db, seed_domain.intruder.id)
    foreign = intruder_client.post(
        f"{B}/jobs/{own_job}/deep-score", json={"resumeId": str(v_resume)}
    )
    unknown = intruder_client.post(
        f"{B}/jobs/{own_job}/deep-score", json={"resumeId": str(UNKNOWN)}
    )
    assert foreign.status_code == unknown.status_code == 404
    assert foreign.json()["kind"] == unknown.json()["kind"] == "not_found"
    assert _runs_for(db, seed_domain.intruder.id) == []
    # and the victim gained no run either (only their pre-seeded one)
    assert len(_runs_for(db, seed_domain.test_user.id)) == 1


def test_budget_isolation_between_tenants(
    db: Session, intruder_client: TestClient, seed_domain: SeededUsers
) -> None:
    """The victim's 15.00 spend never shows in the intruder's headroom."""
    _victim_world(db, seed_domain)
    own_job, own_resume = _mk_pair(db, seed_domain.intruder.id)
    resp = intruder_client.post(
        f"{B}/jobs/{own_job}/preview-deep-score",
        json={"resumeIds": [str(own_resume)]},
    )
    assert resp.status_code == 200
    assert resp.json()["capRemainingUsd"] == 20.0


def test_delete_scored_resume_409_via_fk_backstop(
    db: Session, db_client: TestClient, seed_domain: SeededUsers
) -> None:
    """PIN-A14: a scored resume (referenced by ai_run + match_report, both
    append-only) refuses deletion at the DB; the constraint-name
    disambiguation maps it to the SAME 409 lock-conflict envelope. The
    resume is an unlocked DRAFT with used_in=0, so ONLY the backstop can
    fire -- this discriminates the FK path from the app-level check."""
    user = seed_domain.test_user
    job_id, resume_id = _mk_pair(db, user.id)
    _mk_report(db, user.id, job_id, resume_id)
    resp = db_client.delete(f"{B}/resumes/{resume_id}")
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"
    # the row survived
    assert db.exec(
        select(models.Resume).where(models.Resume.id == resume_id)
    ).first() is not None
