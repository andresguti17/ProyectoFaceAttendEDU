"""MongoDB (Motor) adapter for `BiometricRepositoryPort`.

One class serves both modalities; `biometric_type` selects the collection and
decides whether `finger_number` is part of a template's identity.

Concurrency note: `back-end/docker-compose.yml` runs `mongo:7` as a **standalone**
instance (no replica set), so multi-document transactions are unavailable. The
enroll path is therefore ordered to respect the unique partial index —
deactivate the current active version first, then insert the new one. A crash
between the two steps leaves the person with no active template, which fails
closed (verify/identify return 404) rather than silently matching a stale one.
"""
from __future__ import annotations

import logging
from dataclasses import replace
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

from domain.entities.biometric_template import BiometricTemplate
from domain.entities.facial_embedding import FacialEmbedding
from domain.entities.fingerprint_embedding import FingerprintEmbedding
from domain.ports.out.biometric_repository import BiometricRepositoryPort
from domain.value_objects.biometric_type import BiometricType
from infrastructure.config.settings import Settings
from infrastructure.persistence.document_mappers import (
    alive_filter,
    document_to_embedding,
    embedding_to_document,
)
from infrastructure.persistence.errors import ConcurrencyConflictError
from infrastructure.persistence.mongo_client import MongoClient

logger = logging.getLogger("biometric.persistence")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MongoEmbeddingRepository(BiometricRepositoryPort):
    def __init__(
        self,
        client: MongoClient,
        settings: Settings,
        biometric_type: BiometricType,
    ) -> None:
        self._client = client
        self._settings = settings
        self._type = biometric_type

    # -- Internals ------------------------------------------------------
    @property
    def collection_name(self) -> str:
        if self._type is BiometricType.FINGERPRINT:
            return self._settings.fingerprint_collection
        return self._settings.facial_collection

    @property
    def _collection(self) -> AsyncIOMotorCollection:
        # `db` raises PersistenceUnavailableError when Mongo is not connected.
        return self._client.db[self.collection_name]

    def _scope(
        self, person_id: str | None = None, finger_number: int | None = None
    ) -> dict[str, Any]:
        """Query fragment identifying a template scope."""
        if finger_number is not None and self._type is BiometricType.FACIAL:
            raise ValueError("facial templates have no finger_number")
        scope: dict[str, Any] = {}
        if person_id is not None:
            scope["person_id"] = person_id
        if finger_number is not None:
            scope["finger_number"] = finger_number
        return scope

    def _entity(self, document: dict[str, Any]) -> BiometricTemplate:
        return document_to_embedding(document, self._type)

    # -- Port -----------------------------------------------------------
    async def enroll(self, template: BiometricTemplate) -> BiometricTemplate:
        expected = FingerprintEmbedding if self._type is BiometricType.FINGERPRINT else FacialEmbedding
        if not isinstance(template, expected):
            raise TypeError(
                f"{self.collection_name} stores {expected.__name__}, got {type(template).__name__}"
            )

        finger_number = getattr(template, "finger_number", None)
        scope = self._scope(template.person_id, finger_number)
        now = _utcnow()
        collection = self._collection

        # Version counter = every version ever enrolled for this scope + 1,
        # including superseded and soft-deleted ones, so it never repeats.
        template_version = await collection.count_documents(scope) + 1

        # Deactivate the current active version BEFORE inserting: the unique
        # partial index allows exactly one document with is_active == true per
        # scope. Superseded versions keep deleted_at unset so they stay visible
        # to list_history().
        await collection.update_many(
            {**scope, "is_active": True, **alive_filter()},
            {"$set": {"is_active": False, "updated_at": now}},
        )

        persisted = replace(
            template,
            template_version=template_version,
            is_active=True,
            enrolled_at=template.enrolled_at or now,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        try:
            await collection.insert_one(embedding_to_document(persisted))
        except DuplicateKeyError as exc:
            raise ConcurrencyConflictError(
                f"an active {self._type.value.lower()} template was enrolled concurrently "
                f"for person {template.person_id}"
            ) from exc

        logger.info(
            "Enrolled %s template %s for person %s (version %d)",
            self._type.value.lower(),
            persisted.embedding_id,
            persisted.person_id,
            template_version,
        )
        return persisted

    async def find_active(
        self, person_id: str, finger_number: int | None = None
    ) -> BiometricTemplate | None:
        query = {**self._scope(person_id, finger_number), "is_active": True, **alive_filter()}
        document = await self._collection.find_one(
            query, sort=[("template_version", DESCENDING)]
        )
        return None if document is None else self._entity(document)

    async def list_active(
        self, person_id: str | None = None, finger_number: int | None = None
    ) -> list[BiometricTemplate]:
        query = {**self._scope(person_id, finger_number), "is_active": True, **alive_filter()}
        limit = self._settings.identify_scan_limit if person_id is None else 0
        cursor = self._collection.find(
            query, sort=[("person_id", ASCENDING), ("template_version", DESCENDING)]
        )
        if limit:
            cursor = cursor.limit(limit)
        documents = await cursor.to_list(length=limit or None)

        if limit and len(documents) >= limit:
            # Loud on purpose: hitting the cap means 1:N identify did not
            # consider every candidate, so its answer may be wrong.
            logger.warning(
                "1:N identify scan over %s reached the configured limit of %d documents; "
                "candidates may have been skipped. Raise BIOMETRIC_IDENTIFY_SCAN_LIMIT or "
                "move matching to a MongoDB vector search index (ADR-003).",
                self.collection_name,
                limit,
            )
        return [self._entity(document) for document in documents]

    async def list_history(self, person_id: str) -> list[BiometricTemplate]:
        query = {**self._scope(person_id), **alive_filter()}
        documents = await self._collection.find(
            query, sort=[("template_version", ASCENDING)]
        ).to_list(length=None)
        return [self._entity(document) for document in documents]

    async def deactivate(self, person_id: str, finger_number: int | None = None) -> int:
        if not person_id:
            # Never allow a store-wide soft delete through a missing argument.
            raise ValueError("person_id is required to deactivate templates")
        now = _utcnow()
        result = await self._collection.update_many(
            {**self._scope(person_id, finger_number), "is_active": True, **alive_filter()},
            {"$set": {"is_active": False, "deleted_at": now, "updated_at": now}},
        )
        deactivated = int(result.modified_count)
        if deactivated:
            logger.info(
                "Soft-deleted %d active %s template(s) for person %s",
                deactivated,
                self._type.value.lower(),
                person_id,
            )
        return deactivated
