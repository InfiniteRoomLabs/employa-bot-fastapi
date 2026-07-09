"""Agents resource (ORI-014 / AGT-021 / AGT-023 / D25 AGT-031).

Follows the ``routes/searches.py`` pattern (see its header for the full rule
list). Two route-ordering notes specific to this resource:

* ``/agents/log`` and ``/agents/review-queue`` are both 2-segment paths, the
  same shape as ``/agents/{id}``. FastAPI/Starlette match routes in
  REGISTRATION order, so these two literal routes MUST be declared before
  ``/agents/{id}`` below or ``id="log"`` / ``id="review-queue"`` would shadow
  them and fail UUID validation instead of hitting the real handler.
* 6 of this resource's 14 ops are DEFERRED (founder-ruled 2026-07-04,
  DECISIONS-NEEDED #1/#2): ``getReviewQueue``, ``approveAgentAction``,
  ``rejectAgentAction``, ``patchAgentTrustTier``. They are served as
  mock-parity stubs so the UI functions, but their real approval-machine
  semantics are not frozen. Each is tagged with a ``# DEFERRED (...)`` comment.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app import store
from app.api.errors import NotFoundError
from app.schemas import (
    Agent,
    AgentLogEntry,
    AgentLogKind,
    AgentPermission,
    AgentState,
    AgentTrustTier,
    AgentTrustTierUpdate,
    AgentTrustTierView,
    ReviewQueueItem,
)

router = APIRouter(tags=["agents"])


@router.get("/agents", operation_id="getAgents", response_model=list[Agent])
def get_agents() -> list[Agent]:
    """All agents (getAgents)."""
    return list(store.agents.values())


@router.get(
    "/agents/log", operation_id="getAgentLog", response_model=list[AgentLogEntry]
)
def get_agent_log(
    agentId: UUID | None = None,
    kind: AgentLogKind | None = None,
) -> list[AgentLogEntry]:
    """Agent activity log, optionally filtered by agentId and/or kind."""
    entries = store.agent_log
    if agentId is not None:
        entries = [e for e in entries if e.agentId == agentId]
    if kind is not None:
        entries = [e for e in entries if e.kind == kind]
    return entries


@router.get(
    "/agents/review-queue",
    operation_id="getReviewQueue",
    response_model=list[ReviewQueueItem],
)
def get_review_queue() -> list[ReviewQueueItem]:
    """Agent actions awaiting human approval (AGT-021).

    # DEFERRED (DECISIONS-NEEDED #1): mock-parity stub, real semantics not
    frozen. Derived from ``agent_log`` entries where kind == "await", exactly
    mirroring the mock (there is no separate review-queue store).
    """
    return store.review_queue_items()


@router.get("/agents/{id}", operation_id="getAgent", response_model=Agent)
def get_agent(id: UUID) -> Agent:
    """One agent (getAgent). 404 envelope on unknown id."""
    hit = store.agents.get(id)
    if hit is None:
        raise NotFoundError(f"agents/{id}")
    return hit


class PatchAgentInput(BaseModel):
    """Request body for ``patchAgent`` -- contract defines this inline (no
    named schema), so it is modeled locally here rather than in the generated
    ``models.py``.
    """

    state: AgentState | None = None
    live: bool | None = None


@router.patch("/agents/{id}", operation_id="patchAgent", response_model=Agent)
def patch_agent(id: UUID, body: PatchAgentInput) -> Agent:
    """Patch mutable agent fields (ORI-014 pause / run-now).

    Mirrors mock api.ts merge semantics: only client-sent fields (``state``
    and/or ``live``) override; everything else on the agent is preserved.
    """
    existing = store.agents.get(id)
    if existing is None:
        raise NotFoundError(f"agents/{id}")
    updated = existing.model_copy(update=body.model_dump(exclude_unset=True))
    store.agents[id] = updated
    return updated


@router.get(
    "/agents/{id}/permissions",
    operation_id="getAgentPermissions",
    response_model=list[AgentPermission],
)
def get_agent_permissions(id: UUID) -> list[AgentPermission]:
    """Per-agent permission grants (AGT-023).

    Each grant is enriched with its ``requiredTier`` (D25 / AGT-031) at read
    time via ``PERMISSION_REQUIRED_TIER``, defaulting to ``observe`` for any
    unmapped permission label. Unknown agent id -> empty list (no 404; the
    contract defines none for this route, matching the mock).
    """
    perms = store.agent_permissions.get(id, [])
    return [
        p.model_copy(
            update={
                "requiredTier": p.requiredTier
                or store.PERMISSION_REQUIRED_TIER.get(
                    p.permission, AgentTrustTier.observe
                )
            }
        )
        for p in perms
    ]


@router.get(
    "/agents/{id}/trust-tier",
    operation_id="getAgentTrustTier",
    response_model=AgentTrustTierView,
)
def get_agent_trust_tier(id: UUID) -> AgentTrustTierView:
    """Agent trust standing + ladder (D25 / AGT-031). 404 on unknown agent."""
    agent = store.agents.get(id)
    if agent is None:
        raise NotFoundError(f"agents/{id}/trust-tier")
    return AgentTrustTierView(
        agentId=id,
        currentTier=agent.trustTier or AgentTrustTier.observe,
        ladder=store.TRUST_TIER_LADDER,
    )


class PatchAgentTrustTierInput(BaseModel):
    """Request body for ``patchAgentTrustTier`` -- inline in the contract, no
    named schema; modeled locally like ``PatchAgentInput`` above.
    """

    targetTier: AgentTrustTier


@router.patch(
    "/agents/{id}/trust-tier",
    operation_id="patchAgentTrustTier",
    response_model=AgentTrustTierUpdate,
)
def patch_agent_trust_tier(
    id: UUID, body: PatchAgentTrustTierInput
) -> AgentTrustTierUpdate:
    """Set an agent's trust tier (soft-gated).

    # DEFERRED (DECISIONS-NEEDED #2): mock-parity stub, real semantics not
    frozen. ``status`` is an opaque contract string (state model deferred);
    mirrors the mock by always granting immediately and updating the agent's
    ``trustTier`` in place.
    """
    existing = store.agents.get(id)
    if existing is None:
        raise NotFoundError(f"agents/{id}/trust-tier")
    store.agents[id] = existing.model_copy(update={"trustTier": body.targetTier})
    return AgentTrustTierUpdate(
        agentId=id,
        currentTier=body.targetTier,
        status="granted",
        message=f"Trust tier set to {body.targetTier.value}.",
    )


@router.post(
    "/agents/review-queue/{id}/approve",
    operation_id="approveAgentAction",
    status_code=204,
)
def approve_agent_action(id: UUID) -> None:
    """Approve a queued agent action.

    # DEFERRED (DECISIONS-NEEDED #1): mock-parity stub, real semantics not
    frozen. No-op success (mirrors the mock: no persistent state change
    beyond acknowledging the request). 404s if ``id`` doesn't match a
    currently pending review-queue entry.
    """
    if id not in {item.id for item in store.review_queue_items()}:
        raise NotFoundError(f"agents/review-queue/{id}/approve")


@router.post(
    "/agents/review-queue/{id}/reject",
    operation_id="rejectAgentAction",
    status_code=204,
)
def reject_agent_action(id: UUID) -> None:
    """Reject a queued agent action.

    # DEFERRED (DECISIONS-NEEDED #1): mock-parity stub, real semantics not
    frozen. No-op success, same shape as ``approveAgentAction``.
    """
    if id not in {item.id for item in store.review_queue_items()}:
        raise NotFoundError(f"agents/review-queue/{id}/reject")
