"""MongoDB (Motor) adapter for `MatchLogRepositoryPort`.

Append-only audit trail of verify/identify attempts. Documents expire through
the collection's TTL index (`ttl_<coll>_created_at`, 90 days by default), so
there is no delete path here at all.
"""
from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.match_log import BiometricMatchLog
from domain.ports.out.match_log_repository import MatchLogRepositoryPort
from infrastructure.config.settings import Settings
from infrastructure.persistence.document_mappers import match_log_to_document
from infrastructure.persistence.mongo_client import MongoClient

logger = logging.getLogger("biometric.persistence")


class MongoMatchLogRepository(MatchLogRepositoryPort):
    def __init__(self, client: MongoClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    @property
    def collection_name(self) -> str:
        return self._settings.match_log_collection

    @property
    def _collection(self) -> AsyncIOMotorCollection:
        return self._client.db[self.collection_name]

    async def record(self, entry: BiometricMatchLog) -> None:
        await self._collection.insert_one(match_log_to_document(entry))
        logger.debug(
            "Recorded %s %s match log for person %s (matched=%s, score=%.4f)",
            entry.biometric_type.value,
            entry.operation,
            entry.person_id,
            entry.matched,
            entry.score,
        )
