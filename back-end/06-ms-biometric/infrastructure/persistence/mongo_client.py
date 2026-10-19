"""Motor (async MongoDB) client wrapper plus index bootstrap.

One client per process, created in `main.py`'s lifespan and published on
`app.state.mongo_client`; repositories receive it through
`infrastructure.config.dependencies`.

Health statuses (see SERVICE.md §4.5):

* ``ok``       - ping succeeded and the ADR-003 indexes are in place
* ``degraded`` - ping succeeded but index bootstrap failed
* ``down``     - MongoDB is unreachable
* ``disabled`` - ``BIOMETRIC_MONGO_ENABLED=false``; requests fail loudly
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import OperationFailure, PyMongoError

from infrastructure.config.settings import Settings
from infrastructure.persistence.errors import PersistenceUnavailableError

logger = logging.getLogger("biometric.persistence")

STATUS_OK = "ok"
STATUS_DEGRADED = "degraded"
STATUS_DOWN = "down"
STATUS_DISABLED = "disabled"

IndexKey = list[tuple[str, int]]
IndexPlanEntry = tuple[str, str, IndexKey, dict[str, Any]]


def _embedding_index_specs(collection: str, *, with_finger: bool) -> list[dict[str, Any]]:
    """Template-collection indexes required by ADR-003 / 06-data/domains/06-biometric.md.

    * ``ux_<coll>_active`` - unique **partial** index (``is_active == true``)
      that enforces the domain invariant "at most one active template per
      person (+finger)" inside the database instead of in application code.
    * ``idx_<coll>_lookup`` - compound index used by the read paths.
    * ``idx_<coll>_deleted`` - sparse index over ``deleted_at``. Documents that
      are not soft-deleted omit the field entirely, so this index holds only
      tombstones.
    """
    scope_keys: IndexKey = [("person_id", ASCENDING)]
    if with_finger:
        scope_keys.append(("finger_number", ASCENDING))
    return [
        {
            "name": f"ux_{collection}_active",
            "keys": list(scope_keys),
            "options": {"unique": True, "partialFilterExpression": {"is_active": True}},
        },
        {
            "name": f"idx_{collection}_lookup",
            "keys": [*scope_keys, ("is_active", ASCENDING)],
            "options": {},
        },
        {
            "name": f"idx_{collection}_deleted",
            "keys": [("deleted_at", ASCENDING)],
            "options": {"sparse": True},
        },
    ]


class MongoClient:
    """Thin lifecycle wrapper around ``AsyncIOMotorClient``."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: AsyncIOMotorClient | None = None
        self._status: str = STATUS_DISABLED if not settings.mongo_enabled else STATUS_DOWN
        self._status_checked_at: float = 0.0
        self._detail: str = ""

    # -- Introspection --------------------------------------------------
    @property
    def enabled(self) -> bool:
        return self._settings.mongo_enabled

    @property
    def database_name(self) -> str:
        return self._settings.mongo_db_name

    @property
    def db(self) -> AsyncIOMotorDatabase:
        """The service database. Raises when the client is not connected."""
        if self._client is None:
            raise PersistenceUnavailableError(
                "MongoDB client is not connected; biometric persistence is unavailable"
            )
        return self._client[self._settings.mongo_db_name]

    @property
    def status(self) -> str:
        return self._status

    @property
    def detail(self) -> str:
        return self._detail

    # -- Lifecycle ------------------------------------------------------
    async def connect(self) -> None:
        """Open the client, verify reachability and bootstrap indexes.

        Never raises: a database that is down at boot must not stop the process
        from answering ``/health``. Requests that actually need data fail loudly
        instead, through ``db`` or through the driver error they raise.
        """
        if not self._settings.mongo_enabled:
            self._record(STATUS_DISABLED, "BIOMETRIC_MONGO_ENABLED is false")
            logger.warning("MongoDB persistence is disabled by configuration")
            return

        self._client = AsyncIOMotorClient(
            self._settings.mongodb_url,
            serverSelectionTimeoutMS=self._settings.server_selection_timeout_ms,
            uuidRepresentation="standard",
            tz_aware=True,
            tzinfo=timezone.utc,
        )
        try:
            await self.ping()
        except (PyMongoError, asyncio.TimeoutError, OSError) as exc:
            self._record(STATUS_DOWN, f"{type(exc).__name__}: {exc}")
            logger.exception(
                "MongoDB unreachable at startup (db=%s); biometric requests will fail "
                "until the database recovers",
                self._settings.mongo_db_name,
            )
            return

        try:
            await self.ensure_indexes()
        except (PyMongoError, asyncio.TimeoutError, OSError) as exc:
            self._record(STATUS_DEGRADED, f"{type(exc).__name__}: {exc}")
            logger.exception("MongoDB index bootstrap failed (db=%s)", self.database_name)
            return

        self._record(STATUS_OK, "")
        logger.info("Connected to MongoDB database %s", self.database_name)

    async def disconnect(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None
        self._record(STATUS_DOWN, "client closed")

    async def ping(self) -> None:
        """Round-trip to the server. Raises on failure; callers decide what it means."""
        if self._client is None:
            raise PersistenceUnavailableError("MongoDB client is not connected")
        await asyncio.wait_for(
            self._client.admin.command("ping"),
            timeout=self._settings.health_ping_timeout_seconds,
        )

    async def health(self) -> tuple[str, str]:
        """``(status, detail)``, briefly cached so probes cannot stampede the server."""
        if self._status == STATUS_DISABLED:
            return STATUS_DISABLED, self._detail

        age = time.monotonic() - self._status_checked_at
        if self._status_checked_at and age < self._settings.health_cache_seconds:
            return self._status, self._detail

        try:
            await self.ping()
        except PersistenceUnavailableError as exc:
            self._record(STATUS_DOWN, str(exc))
        except (PyMongoError, asyncio.TimeoutError, OSError) as exc:
            self._record(STATUS_DOWN, f"{type(exc).__name__}: {exc}")
            logger.error("MongoDB health ping failed: %s", exc)
        else:
            # A successful ping does not undo a failed index bootstrap.
            if self._status == STATUS_DEGRADED:
                self._status_checked_at = time.monotonic()
            else:
                self._record(STATUS_OK, "")
        return self._status, self._detail

    # -- Index bootstrap ------------------------------------------------
    def index_plan(self) -> list[IndexPlanEntry]:
        """Every index this service owns, as ``(collection, name, keys, options)``."""
        facial = self._settings.facial_collection
        fingerprint = self._settings.fingerprint_collection
        cases = self._settings.update_case_collection
        logs = self._settings.match_log_collection

        plan: list[IndexPlanEntry] = [
            (facial, spec["name"], spec["keys"], spec["options"])
            for spec in _embedding_index_specs(facial, with_finger=False)
        ]
        plan += [
            (fingerprint, spec["name"], spec["keys"], spec["options"])
            for spec in _embedding_index_specs(fingerprint, with_finger=True)
        ]
        plan += [
            (cases, f"ux_{cases}_request_id", [("request_id", ASCENDING)], {"unique": True}),
            (
                cases,
                f"idx_{cases}_person_status",
                [("person_id", ASCENDING), ("status", ASCENDING)],
                {},
            ),
            (cases, f"idx_{cases}_deleted", [("deleted_at", ASCENDING)], {"sparse": True}),
            (
                # TTL: match logs self-expire after the configured retention
                # (security-rules.md A09 keeps security logs for >= 90 days).
                logs,
                f"ttl_{logs}_created_at",
                [("created_at", ASCENDING)],
                {"expireAfterSeconds": self._settings.match_log_ttl_seconds},
            ),
            (
                logs,
                f"idx_{logs}_person_created",
                [("person_id", ASCENDING), ("created_at", DESCENDING)],
                {},
            ),
        ]
        return plan

    async def ensure_indexes(self) -> None:
        """Create every index idempotently. Safe to call on each startup."""
        database = self.db
        for collection_name, index_name, keys, options in self.index_plan():
            try:
                await database[collection_name].create_index(
                    keys, name=index_name, background=True, **options
                )
            except OperationFailure:
                # An index with this name but a different definition already
                # exists. That is real schema drift, not a no-op: report it.
                logger.exception(
                    "Index %s on %s could not be created (conflicting definition?)",
                    index_name,
                    collection_name,
                )
                raise
            logger.debug("Ensured index %s on %s", index_name, collection_name)

    # -- Internals ------------------------------------------------------
    def _record(self, status: str, detail: str) -> None:
        self._status = status
        self._detail = detail
        self._status_checked_at = time.monotonic()
