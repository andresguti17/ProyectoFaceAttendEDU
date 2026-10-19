"""Biometric update case — domain entity.

A request to re-enroll a person's biometric template, plus its review outcome.
Persisted in the MongoDB `biometric_update_cases` collection (ADR-003 names the
aggregate `Facial_Update_Case`).

Note on ownership: fae-docs/06-data/domains/06-biometric.md places the
*canonical* update case in the Configuration context, while SERVICE.md §4.4
keeps these gateway-facing endpoints here. This entity backs the biometric-side
copy only; it references templates by `embedding_id` and never by foreign key.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from uuid import uuid4

from domain.value_objects.biometric_type import BiometricType
from domain.value_objects.update_case_status import UpdateCaseStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class BiometricUpdateCase:
    person_id: str
    biometric_type: BiometricType
    reason: str
    request_id: str = field(default_factory=lambda: str(uuid4()))
    status: UpdateCaseStatus = UpdateCaseStatus.PENDING
    requested_at: datetime = field(default_factory=_utcnow)
    reviewed_at: datetime | None = None
    current_embedding_ref: str | None = None
    is_active: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    def __post_init__(self) -> None:
        if not self.person_id:
            raise ValueError("person_id must not be empty")
        if not self.reason:
            raise ValueError("reason must not be empty")

    def review(self, status: UpdateCaseStatus, reviewed_at: datetime) -> "BiometricUpdateCase":
        """Return the reviewed copy of this case (entities are immutable).

        `reviewed_at` is stamped only for terminal decisions (Approved /
        Rejected); moving a case to `In_Review` is a transition, not a decision.
        """
        return replace(
            self,
            status=status,
            reviewed_at=reviewed_at if status.is_terminal else self.reviewed_at,
            updated_at=reviewed_at,
        )
