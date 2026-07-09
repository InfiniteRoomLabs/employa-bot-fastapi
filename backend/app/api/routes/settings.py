"""Settings resource (mock API).

Follows the mock route pattern in ``routes/searches.py`` (read its header
comment first). ``getSettings``/``getUsageAggregate`` are singleton reads
(``store.settings`` / ``store.usage_aggregate``), unlike the id-keyed dict
resources -- there is no id-addressed mutation in scope for them here.
"""

from __future__ import annotations

from fastapi import APIRouter

from app import store
from app.schemas import Settings, UsageAggregate

router = APIRouter(tags=["settings"])


@router.get("/settings", operation_id="getSettings", response_model=Settings)
def get_settings() -> Settings:
    """Full settings bundle (getSettings)."""
    return store.settings


@router.get(
    "/usage-aggregate", operation_id="getUsageAggregate", response_model=UsageAggregate
)
def get_usage_aggregate() -> UsageAggregate:
    """Aggregated token-usage summary for the current billing period (getUsageAggregate)."""
    return store.usage_aggregate
