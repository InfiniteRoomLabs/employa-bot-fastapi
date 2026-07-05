"""Scaffold coverage ledger -- the shrinking list of not-yet-scaffolded ops.

The contract drift test (tests/scaffold/test_contract_drift.py) asserts that
the scaffolded operationIds in app.openapi() are EXACTLY the frozen contract
set (mvp-api.yaml, 89 ops) MINUS NOT_YET_SCAFFOLDED below.

PHASE-2 AGENTS: when you land a resource, DELETE its operationIds from
NOT_YET_SCAFFOLDED. The test then requires those routes to exist with the
right operationId, and fails if they do not (or if a stale/extra id appears).

The agents/coach resource group's 6 DEFERRED ops (founder-ruled 2026-07-04,
CONTRACT-NOTES.md, DECISIONS-NEEDED #1/#2) are now scaffolded as mock-parity
stubs -- see ``app/scaffold/routes/agents.py`` and ``routes/coach.py`` for the
per-route ``# DEFERRED (...)`` markers explaining what's not yet frozen:
  * approveAgentAction
  * getReviewQueue
  * patchAgentTrustTier
  * proposeCoachEdit
  * rejectAgentAction
  * saveCoachProposal
"""

from __future__ import annotations

# Every contract op not yet served by a scaffold route. Shrinks over phase 2.
NOT_YET_SCAFFOLDED: frozenset[str] = frozenset(
    {
        "addToShortlist",
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
        "dismissFromShortlist",
        "duplicateResume",
        "forkResumeAsDraft",
        "getAccomplishments",
        "getAnswers",
        "getApplication",
        "getApplicationTimeline",
        "getApplications",
        "getArchive",
        "getArchiveCounts",
        "getCareerHistory",
        "getContact",
        "getContacts",
        "getCredentials",
        "getCurrentUser",
        "getDeletionImpact",
        "getInterviewRounds",
        "getJob",
        "getJobs",
        "getJobsInbox",
        "getMatchReport",
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
        "getShortlist",
        "getTrash",
        "getUsageAggregate",
        "markAllNotificationsRead",
        "markNotificationRead",
        "markWon",
        "patchInterviewRound",
        "patchResume",
        "previewDeepMatchScore",
        "purgeLibraryItem",
        "reactivateApplication",
        "regenerateExport",
        "renderExport",
        "requestDataExport",
        "restoreLibraryItem",
        "runDeepMatchScore",
        "setDefaultResume",
        "transitionApplication",
        "undoMarkWon",
        "updateAccomplishment",
        "updateAnswer",
        "updateContact",
        "updateProject",
    }
)
