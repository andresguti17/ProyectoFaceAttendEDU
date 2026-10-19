"""In-memory sliding-window rate limiter — ported from `10-ms-face-auth`'s
`infrastructure/security/rate_limit.py` verbatim.

Single-process only; use Redis (compatible interface) for multi-replica
deployments. This is the same posture the source service already documented —
`06-ms-biometric` had no rate limiting at all before this merge.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, max_attempts: int = 20, window_seconds: int = 60) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> tuple[bool, int]:
        """Returns (allowed, remaining_attempts). Never raises."""
        now = time.time()
        window = self._hits[key]
        while window and window[0] <= now - self.window_seconds:
            window.popleft()
        if len(window) >= self.max_attempts:
            return False, 0
        window.append(now)
        return True, self.max_attempts - len(window)

    def reset(self, key: str) -> None:  # tests only
        self._hits.pop(key, None)
