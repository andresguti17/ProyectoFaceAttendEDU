"""Bounded, TTL'd cache of WS message outcomes, keyed by `client_message_id`.

Protects the "no lost, no duplicated" requirement: if a connection drops
after the server processed a message but before the ack reached the client,
the client reconnects and resends the same `client_message_id`. The cache
replays the original response instead of re-running enroll/verify/identify a
second time, which would otherwise bump a template version or double-log a
match attempt.
"""
from __future__ import annotations

import time
from collections import OrderedDict
from typing import Any


class IdempotencyCache:
    def __init__(self, max_entries: int = 2_000, ttl_seconds: float = 300.0) -> None:
        self._max_entries = max_entries
        self._ttl_seconds = ttl_seconds
        self._entries: OrderedDict[str, tuple[float, dict[str, Any]]] = OrderedDict()

    def _evict_expired(self) -> None:
        now = time.monotonic()
        expired = [
            key
            for key, (stored_at, _) in self._entries.items()
            if now - stored_at > self._ttl_seconds
        ]
        for key in expired:
            self._entries.pop(key, None)

    def get(self, key: str) -> dict[str, Any] | None:
        self._evict_expired()
        entry = self._entries.get(key)
        if entry is None:
            return None
        self._entries.move_to_end(key)
        return entry[1]

    def set(self, key: str, response: dict[str, Any]) -> None:
        self._evict_expired()
        self._entries[key] = (time.monotonic(), response)
        self._entries.move_to_end(key)
        while len(self._entries) > self._max_entries:
            self._entries.popitem(last=False)
