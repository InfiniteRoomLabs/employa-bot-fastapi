"""Behavior tests for the MOCK-SERVED applications surface. No database.

Since sprint-04 3a, getApplications' default view / getApplication /
createApplication are DB-backed (docs/sprints/sprint-04-spec.md PIN-6); their
fidelity/tenancy/provenance coverage lives in
``tests/api/routes/test_applications.py``. Only getApplications' RECOGNIZED
mock searchId view (BACKEND/AI_INFRA) is still mock-served and covered here
(PIN-3 precedent from ``tests/contract/test_shortlist.py``).

Since sprint-04 3b, transitionApplication and getResumeSnapshot are ALSO
DB-only (PIN-6): mock store fixtures are not transitionable, and the
mock-store fallback getResumeSnapshot/getApplication once had (DEBT-5) is
gone entirely as of 3c. That coverage -- the legal/illegal matrix, version
conflict, the applied/resumeId conditional, and getResumeSnapshot's
conflict/404/synthesis-fallback behavior -- lives entirely in
``tests/api/routes/test_transitions.py`` now.

Since sprint-04 3c, markWon/undoMarkWon/dismissApplication/
reactivateApplication/getApplicationTimeline are ALSO DB-only (PIN-6, the
last 5 of the 20 PIN-6 flips): their mock-store-mutation coverage below is
gone -- it lives in ``tests/api/routes/test_lifecycle.py`` now. What's left
here is ONLY what stays genuinely mock-served: getApplications' recognized
searchId view (searches stay mock through Release 0.1).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.contract.helpers import B

SEARCH_ID_BACKEND = "b53a91e7-0f44-4d2b-8a05-6c1d2e9b4f30"
SEARCH_ID_AI_INFRA = "ad9e6c14-5b80-4f17-a3d2-7e6f9c1b0a55"


# ---------------------------------------------------------------------------
# reads: getApplications' recognized-searchId mock view (PIN-3 precedent)
# ---------------------------------------------------------------------------


def test_get_applications_filters_by_search_id(store_client: TestClient) -> None:
    assert (
        len(
            store_client.get(
                f"{B}/applications", params={"searchId": SEARCH_ID_BACKEND}
            ).json()
        )
        == 3
    )
    assert (
        len(
            store_client.get(
                f"{B}/applications", params={"searchId": SEARCH_ID_AI_INFRA}
            ).json()
        )
        == 1
    )
