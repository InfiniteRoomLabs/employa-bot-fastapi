"""The ONE provider construction site (sprint-05 spec PIN-A9).

Explicit-only, never a fallback: an unknown, empty, or not-yet-shipped
``AI_PROVIDER`` value raises ``ProviderUnavailableError`` (503,
``provider_unavailable``). No code path substitutes the fake provider for
anything else -- AC-07 asserts this file is the only place a provider is
constructed.
"""

from __future__ import annotations

from app.ai.base import AiProvider
from app.ai.fake import FakeAiProvider
from app.api.errors import ProviderUnavailableError
from app.core.config import Settings


def get_provider(settings: Settings) -> AiProvider:
    """Resolve the configured provider, failing closed on anything else."""
    if settings.AI_PROVIDER == "fake":
        return FakeAiProvider()
    raise ProviderUnavailableError(
        f"AI provider {settings.AI_PROVIDER!r} is not available"
    )
