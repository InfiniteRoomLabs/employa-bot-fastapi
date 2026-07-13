"""Login throttling (plan v3 Auth).

Sliding-window counters checked BEFORE password verification -- the throttle
is the DoS guard in front of argon2/bcrypt, so it must be cheap and must not
reveal whether an account exists (one uniform message). Limits live in
``Settings`` (``LOGIN_THROTTLE_*``, defaults pinned in sprint-01-spec PIN-7)
so they tune via env like every other config value.

In-memory by design: the MVP runs a single backend process. Multi-worker /
multi-node throttling is recorded debt (progress.md open-debt ledger), not
silent scope.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from app.core.config import settings

_WINDOW_SECONDS = 60.0

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def _over_limit(key: str, limit: int, now: float) -> bool:
    window = _hits[key]
    cutoff = now - _WINDOW_SECONDS
    while window and window[0] <= cutoff:
        window.popleft()
    if len(window) >= limit:
        return True
    window.append(now)
    return False


def login_attempt_allowed(*, account: str, ip: str) -> bool:
    """Record one login attempt; False when any window is exhausted.

    Every attempt counts (success or failure) -- counting happens before the
    password is ever looked at.
    """
    now = time.monotonic()
    with _lock:
        # No short-circuiting: every window records the attempt.
        over = _over_limit("global", settings.LOGIN_THROTTLE_GLOBAL_PER_MINUTE, now)
        over = (
            _over_limit(f"ip:{ip}", settings.LOGIN_THROTTLE_IP_PER_MINUTE, now) or over
        )
        over = (
            _over_limit(
                f"account:{account.lower()}",
                settings.LOGIN_THROTTLE_ACCOUNT_PER_MINUTE,
                now,
            )
            or over
        )
        return not over


def reset() -> None:
    """Test hook: drop all windows."""
    with _lock:
        _hits.clear()
