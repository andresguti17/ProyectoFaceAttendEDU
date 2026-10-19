"""Fingerprint embedding — domain entity.

Persisted in the MongoDB `fingerprint_embeddings` collection
(fae-docs/06-data/domains/06-biometric.md §2).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

MIN_FINGER_NUMBER = 1
MAX_FINGER_NUMBER = 10


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class FingerprintEmbedding:
    """One version of a person's template for a single finger.

    Immutable: state transitions produce a new instance via
    `dataclasses.replace`.
    """

    person_id: str
    finger_number: int
    encoding: list[float]
    model_version: str
    embedding_id: str = field(default_factory=lambda: str(uuid4()))
    template_version: int = 1
    is_active: bool = True
    enrolled_at: datetime = field(default_factory=_utcnow)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    # Raw-sample path (ported from 10-ms-face-auth): a fingerprint sample is
    # matched by OpenCV keypoint count, not cosine similarity over a fixed-length
    # vector, so a raw-sample record stores the sample instead of `encoding` and
    # leaves `encoding` empty. Vector-based records (existing clients) populate
    # `encoding` and leave these `None`. A document predating this merge has
    # neither field set in Mongo — reads default both to `None` (see
    # `document_to_embedding`).
    raw_sample_b64: str | None = None
    sample_format: int | None = None

    def __post_init__(self) -> None:
        if not MIN_FINGER_NUMBER <= self.finger_number <= MAX_FINGER_NUMBER:
            raise ValueError(
                f"finger_number must be between {MIN_FINGER_NUMBER} and {MAX_FINGER_NUMBER}"
            )
        if not self.person_id:
            raise ValueError("person_id must not be empty")
        if not self.encoding and not self.raw_sample_b64:
            raise ValueError("either encoding or raw_sample_b64 must be set")
