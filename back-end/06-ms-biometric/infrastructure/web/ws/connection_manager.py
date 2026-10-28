"""In-process registry of active biometric WebSocket connections.

Backs the real-time notification fan-out: every successful enroll/identify
is pushed to the other connected clients (dashboards, attendance kiosks) of
the SAME school, in addition to the ack the originating client gets for its
own request. Only a Super Administrador (or a deployment with auth disabled)
sees the events of every school.

Scoped to one process. Multiple replicas of this service would each keep
their own registry — acceptable today (a single instance in
docker-compose) and out of scope for this change.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger("biometric.ws")

# (sees_all, school_id): what a connection may receive. Resolved once per
# connection from the authenticated user, never from anything the client sends.
Scope = tuple[bool, str | None]
UNRESTRICTED: Scope = (True, None)


class ConnectionManager:
    def __init__(self) -> None:
        # socket -> (owner user id or None when auth is disabled, scope)
        self._connections: dict[WebSocket, tuple[str | None, Scope]] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self, websocket: WebSocket, owner: str | None, max_per_owner: int, scope: Scope = UNRESTRICTED
    ) -> bool:
        """Registers the socket unless `owner` already holds `max_per_owner` of them,
        so one session cannot pin an unbounded number of long-lived connections."""
        async with self._lock:
            held = sum(1 for held_by, _ in self._connections.values() if held_by == owner)
            if held >= max_per_owner:
                return False
            self._connections[websocket] = (owner, scope)
            return True

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.pop(websocket, None)

    async def broadcast(
        self, message: dict, *, exclude: WebSocket | None = None, school_id: str | None = None
    ) -> None:
        """Best-effort fan-out: one dead peer must never block or drop the rest.

        A connection receives the message when it sees every school, or when it
        belongs to `school_id`. An event whose school is unknown (`None`) only
        reaches the connections that see every school: fail secure, never
        "everyone".
        """
        async with self._lock:
            targets = [
                ws
                for ws, (_, (sees_all, own_school)) in self._connections.items()
                if ws is not exclude and (sees_all or (school_id is not None and own_school == school_id))
            ]
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 - a peer dropping mid-broadcast is not fatal
                logger.debug("dropped broadcast to a stale websocket connection")

    def connection_count(self) -> int:
        return len(self._connections)
