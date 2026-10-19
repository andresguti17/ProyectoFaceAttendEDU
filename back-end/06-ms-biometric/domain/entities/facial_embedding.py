"""Facial embedding — domain entity.

Persisted in the MongoDB `facial_embeddings` collection
(fae-docs/06-data/domains/06-biometric.md §1).

`person_id` carries the Identity context's Person UUID in its canonical string
form: the Biometric context never resolves it and no foreign key exists
(cross-context reference by UUID only, ADR-003). It is kept as `str` rather than
`uuid.UUID` because this context does not own — and therefore must not validate
— another context's identifier.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class FacialEmbedding:
    """One version of a person's facial template.

    Immutable: state transitions (supersede, soft delete) produce a new instance
    via `dataclasses.replace`, so a persisted template can never be mutated in
    place by a caller.
    """

    person_id: str
    encoding: list[float]
    model_version: str
    embedding_id: str = field(default_factory=lambda: str(uuid4()))
    template_version: int = 1
    is_active: bool = True
    enrolled_at: datetime = field(default_factory=_utcnow)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    def __post_init__(self) -> None:
        if not self.person_id:
            raise ValueError("person_id must not be empty")
        if not self.encoding:
            raise ValueError("encoding must not be empty")
