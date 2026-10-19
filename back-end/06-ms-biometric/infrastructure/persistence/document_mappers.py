"""BSON <-> domain entity mapping.

Document shapes follow fae-docs/06-data/domains/06-biometric.md, with two
deliberate, documented deviations:

1. ``_id`` is a **UUID string**, not an ``ObjectId``. security-rules.md A04
   forbids exposing sequential internal identifiers, and
   09-microservices/services/05-biometric-service/data-model.md declares the
   primary key as ``embedding_id: UUID``. Using the UUID as ``_id`` keeps the
   HTTP response field ``_id`` stable for existing clients.
2. ``deleted_at`` is **omitted** rather than stored as ``null`` while the
   document is alive. A sparse index skips missing fields but indexes explicit
   nulls, so omitting it is what makes ``idx_*_deleted`` hold only tombstones.
   Queries use ``{"deleted_at": None}``, which MongoDB matches against both a
   missing field and an explicit null.

``person_id`` is stored as a string: it is another context's UUID and this
service references it without owning or validating it (no FK, ADR-003).
"""
from __future__ import annotations

from typing import Any

from domain.entities.facial_embedding import FacialEmbedding
from domain.entities.fingerprint_embedding import FingerprintEmbedding
from domain.entities.match_log import BiometricMatchLog
from domain.entities.update_case import BiometricUpdateCase
from domain.value_objects.biometric_type import BiometricType
from domain.value_objects.update_case_status import UpdateCaseStatus


def alive_filter() -> dict[str, Any]:
    """Fresh filter fragment matching documents that have not been soft-deleted.

    ``{"deleted_at": None}`` matches both an explicit null and a missing field,
    which is what lets live documents omit ``deleted_at`` entirely.
    """
    return {"deleted_at": None}


# -- Templates -----------------------------------------------------------
def embedding_to_document(entity: FacialEmbedding | FingerprintEmbedding) -> dict[str, Any]:
    """Serialise a template entity. ``finger_number`` is written for fingerprints only."""
    document: dict[str, Any] = {
        "_id": entity.embedding_id,
        "person_id": entity.person_id,
        "encoding": [float(value) for value in entity.encoding],
        "model_version": entity.model_version,
        "template_version": int(entity.template_version),
        "enrolled_at": entity.enrolled_at,
        "is_active": bool(entity.is_active),
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }
    finger = getattr(entity, "finger_number", None)
    if finger is not None:
        document["finger_number"] = int(finger)
    raw_sample_b64 = getattr(entity, "raw_sample_b64", None)
    if raw_sample_b64 is not None:
        document["raw_sample_b64"] = raw_sample_b64
    sample_format = getattr(entity, "sample_format", None)
    if sample_format is not None:
        document["sample_format"] = int(sample_format)
    if entity.deleted_at is not None:
        document["deleted_at"] = entity.deleted_at
    return document


def document_to_embedding(
    document: dict[str, Any], biometric_type: BiometricType
) -> FacialEmbedding | FingerprintEmbedding:
    """Rebuild the right entity class for the collection the document came from."""
    shared: dict[str, Any] = {
        "embedding_id": str(document["_id"]),
        "person_id": str(document["person_id"]),
        "encoding": [float(value) for value in document.get("encoding") or []],
        "model_version": str(document.get("model_version") or ""),
        "template_version": int(document.get("template_version") or 1),
        "is_active": bool(document.get("is_active", True)),
        "enrolled_at": document.get("enrolled_at"),
        "created_at": document.get("created_at"),
        "updated_at": document.get("updated_at"),
        "deleted_at": document.get("deleted_at"),
    }
    if biometric_type is BiometricType.FINGERPRINT:
        return FingerprintEmbedding(
            finger_number=int(document["finger_number"]),
            raw_sample_b64=document.get("raw_sample_b64"),
            sample_format=document.get("sample_format"),
            **shared,
        )
    return FacialEmbedding(**shared)


# -- Update cases --------------------------------------------------------
def update_case_to_document(entity: BiometricUpdateCase) -> dict[str, Any]:
    document: dict[str, Any] = {
        "_id": entity.request_id,
        "request_id": entity.request_id,
        "person_id": entity.person_id,
        "biometric_type": entity.biometric_type.value,
        "reason": entity.reason,
        "status": entity.status.value,
        "requested_at": entity.requested_at,
        "reviewed_at": entity.reviewed_at,
        "current_embedding_ref": entity.current_embedding_ref,
        "is_active": bool(entity.is_active),
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }
    if entity.deleted_at is not None:
        document["deleted_at"] = entity.deleted_at
    return document


def document_to_update_case(document: dict[str, Any]) -> BiometricUpdateCase:
    raw_status = document.get("status") or UpdateCaseStatus.PENDING.value
    return BiometricUpdateCase(
        request_id=str(document.get("request_id") or document["_id"]),
        person_id=str(document["person_id"]),
        biometric_type=BiometricType(document["biometric_type"]),
        reason=str(document.get("reason") or ""),
        status=UpdateCaseStatus(raw_status),
        requested_at=document.get("requested_at"),
        reviewed_at=document.get("reviewed_at"),
        current_embedding_ref=document.get("current_embedding_ref"),
        is_active=bool(document.get("is_active", True)),
        created_at=document.get("created_at"),
        updated_at=document.get("updated_at"),
        deleted_at=document.get("deleted_at"),
    )


# -- Match logs ----------------------------------------------------------
def match_log_to_document(entity: BiometricMatchLog) -> dict[str, Any]:
    return {
        "_id": entity.log_id,
        "person_id": entity.person_id,
        "matched_person_id": entity.matched_person_id,
        "biometric_type": entity.biometric_type.value,
        "operation": entity.operation,
        "matched": bool(entity.matched),
        "score": float(entity.score),
        "threshold": float(entity.threshold),
        "finger_number": entity.finger_number,
        "embedding_id": entity.embedding_id,
        "correlation_id": entity.correlation_id,
        # TTL key: the collection's expireAfterSeconds index reads this field.
        "created_at": entity.created_at,
    }


def document_to_match_log(document: dict[str, Any]) -> BiometricMatchLog:
    biometric_type = document.get("biometric_type") or BiometricType.FACIAL.value
    return BiometricMatchLog(
        log_id=str(document["_id"]),
        person_id=document.get("person_id"),
        matched_person_id=document.get("matched_person_id"),
        biometric_type=BiometricType(biometric_type),
        operation=str(document.get("operation") or ""),
        matched=bool(document.get("matched", False)),
        score=float(document.get("score") or 0.0),
        threshold=float(document.get("threshold") or 0.0),
        finger_number=document.get("finger_number"),
        embedding_id=document.get("embedding_id"),
        correlation_id=document.get("correlation_id"),
        created_at=document.get("created_at"),
    )
