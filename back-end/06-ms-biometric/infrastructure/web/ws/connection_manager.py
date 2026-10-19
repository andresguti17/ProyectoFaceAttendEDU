"""In-process registry of active biometric WebSocket connections.

Backs the real-time notification fan-out: every successful enroll/identify
is pushed to every other connected client (dashboards, attendance kiosks),
in addition to the ack the originating client gets for its own request.

Scoped to one process. Multiple replicas of this service would each keep
their own registry — acceptable today (a single instance in
docker-compose) and out of scope for this change.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger("biometric.ws")


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, message: dict, *, exclude: WebSocket | None = None) -> None:
        """Best-effort fan-out: one dead peer must never block or drop the rest."""
        async with self._lock:
            targets = [ws for ws in self._connections if ws is not exclude]
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 - a peer dropping mid-broadcast is not fatal
                logger.debug("dropped broadcast to a stale websocket connection")

    def connection_count(self) -> int:
        return len(self._connections)
