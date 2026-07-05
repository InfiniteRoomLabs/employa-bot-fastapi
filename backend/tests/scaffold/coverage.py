"""Scaffold coverage ledger -- the shrinking list of not-yet-scaffolded ops.

The contract drift test (tests/scaffold/test_contract_drift.py) asserts that
the scaffolded operationIds in app.openapi() are EXACTLY the frozen contract
set (mvp-api.yaml, 89 ops) MINUS NOT_YET_SCAFFOLDED below.

PHASE-2 AGENTS: when you land a resource, DELETE its operationIds from
NOT_YET_SCAFFOLDED. The test then requires those routes to exist with the
right operationId, and fails if they do not (or if a stale/extra id appears).

The 6 DEFERRED ops (founder-ruled 2026-07-04, CONTRACT-NOTES.md) stay here
until the founder rules -- they are in the contract but NOT implementable:
  * approveAgentAction
  * getReviewQueue
  * patchAgentTrustTier
  * proposeCoachEdit
  * rejectAgentAction
  * saveCoachProposal
"""

from __future__ import annotations

# 6 deferred ops -- NOT scaffoldable until the founder rules. Kept as a named
# subset so phase-2 agents do not accidentally try to implement them.
DEFERRED: frozenset[str] = frozenset(
    {
        "approveAgentAction",
        "getReviewQueue",
        "patchAgentTrustTier",
        "proposeCoachEdit",
        "rejectAgentAction",
        "saveCoachProposal",
    }
)

# Every contract op not yet served by a scaffold route. Shrinks over phase 2.
NOT_YET_SCAFFOLDED: frozenset[str] = DEFERRED | frozenset(
    {
        "assignTemplate",
        "createAccomplishment",
        "createAnswer",
        "createApplication",
        "createContact",
        "createProject",
        "createProjection",
        "createResume",
        "deleteAccomplishment",
        "deleteAccount",
        "deleteAnswer",
        "deleteContact",
        "deleteProject",
        "deleteResume",
        "deriveAccomplishmentFromProject",
        "dismissApplication",
        "duplicateResume",
        "forkResumeAsDraft",
        "getAccomplishments",
        "getAgent",
        "getAgentLog",
        "getAgentPermissions",
        "getAgentTrustTier",
        "getAgents",
        "getAnswers",
        "getApplication",
        "getApplicationTimeline",
        "getApplications",
        "getArchive",
        "getArchiveCounts",
        "getCareerHistory",
        "getCoachThread",
        "getCoachThreads",
        "getContact",
        "getContacts",
        "getCredentials",
        "getCurrentUser",
        "getDeletionImpact",
        "getInterviewRounds",
        "getNotifications",
        "getProjections",
        "getProjects",
        "getResume",
        "getResumeExports",
        "getResumeSnapshot",
        "getResumeTemplates",
        "getResumeUploads",
        "getResumes",
        "getSettings",
        "getTrash",
        "getUsageAggregate",
        "markAllNotificationsRead",
        "markNotificationRead",
        "markWon",
        "patchAgent",
        "patchInterviewRound",
        "patchResume",
        "purgeLibraryItem",
        "reactivateApplication",
        "regenerateExport",
        "renderExport",
        "requestDataExport",
        "restoreLibraryItem",
        "setDefaultResume",
        "transitionApplication",
        "undoMarkWon",
        "updateAccomplishment",
        "updateAnswer",
        "updateContact",
        "updateProject",
    }
)
