"""MongoDB (Motor) adapter for `UpdateCaseRepositoryPort`.

Backs the biometric-side copy of the update-request workflow exposed at
`/api/v1/biometric/update-request*` (SERVICE.md §4.4). Soft delete only:
`deactivate` flags the document, nothing is ever removed.
"""
from __future__ import annotations

import logging
from dataclasses import replace
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import DESCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from domain.entities.update_case import BiometricUpdateCase
from domain.ports.out.update_case_repository import UpdateCaseRepositoryPort
from domain.value_objects.update_case_status import UpdateCaseStatus
from infrastructure.config.settings import Settings
from infrastructure.persistence.document_mappers import (
    alive_filter,
    document_to_update_case,
    update_case_to_document,
)
from infrastructure.persistence.errors import ConcurrencyConflictError
from infrastructure.persistence.mongo_client import MongoClient

logger = logging.getLogger("biometric.persistence")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MongoUpdateCaseRepository(UpdateCaseRepositoryPort):
    def __init__(self, client: MongoClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    @property
    def collection_name(self) -> str:
        return self._settings.update_case_collection

    @property
    def _collection(self) -> AsyncIOMotorCollection:
        return self._client.db[self.collection_name]

    @staticmethod
    def _live(request_id: str) -> dict[str, Any]:
        return {"_id": request_id, "is_active": True, **alive_filter()}

    async def create(self, case: BiometricUpdateCase) -> BiometricUpdateCase:
        now = _utcnow()
        persisted = replace(
            case,
            is_active=True,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        try:
            await self._collection.insert_one(update_case_to_document(persisted))
        except DuplicateKeyError as exc:
            raise ConcurrencyConflictError(
                f"update case {persisted.request_id} already exists"
            ) from exc
        logger.info(
            "Created biometric update case %s for person %s (%s)",
            persisted.request_id,
            persisted.person_id,
            persisted.biometric_type.value,
        )
        return persisted

    async def find_by_request_id(self, request_id: str) -> BiometricUpdateCase | None:
        document = await self._collection.find_one(self._live(request_id))
        return None if document is None else document_to_update_case(document)

    async def list_for_person(self, person_id: str) -> list[BiometricUpdateCase]:
        documents = await self._collection.find(
            {"person_id": person_id, "is_active": True, **alive_filter()},
            sort=[("requested_at", DESCENDING)],
        ).to_list(length=None)
        return [document_to_update_case(document) for document in documents]

    async def review(
        self, request_id: str, status: UpdateCaseStatus
    ) -> BiometricUpdateCase | None:
        now = _utcnow()
        updates: dict[str, Any] = {"status": status.value, "updated_at": now}
        # Only a decision (Approved/Rejected) stamps reviewed_at; moving a case
        # to In_Review is a transition.
        if status.is_terminal:
            updates["reviewed_at"] = now

        document = await self._collection.find_one_and_update(
            self._live(request_id),
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        if document is None:
            return None
        logger.info("Update case %s reviewed as %s", request_id, status.value)
        return document_to_update_case(document)

    async def deactivate(self, request_id: str) -> bool:
        now = _utcnow()
        result = await self._collection.update_one(
            self._live(request_id),
            {"$set": {"is_active": False, "deleted_at": now, "updated_at": now}},
        )
        deactivated = result.modified_count > 0
        if deactivated:
            logger.info("Soft-deleted biometric update case %s", request_id)
        return deactivated
