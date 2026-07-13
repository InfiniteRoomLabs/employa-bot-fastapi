"""Shared constants reused across more than one contract test module.

Single-file-only fixtures stay local to their test module; only the
constants actually shared by two or more of the split-out contract test
files live here, to avoid duplicating the same literal in multiple places.
"""

from __future__ import annotations

UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"

# jobs / shortlist / match
JOB_ID_STRIPE = "b7e9c4a1-0d2f-4c83-9a16-1e5f7c3b8d40"
SEARCH_ID_BACKEND = "b53a91e7-0f44-4d2b-8a05-6c1d2e9b4f30"

# applications / interviews / archive
B = "/api/v1"
STRIPE = "6df605b9-9094-4344-8113-ac8b3248f03e"  # platform, applied
MODAL = "24328093-6bbf-4801-8ff7-90337a46a7fa"  # platform, drafting
