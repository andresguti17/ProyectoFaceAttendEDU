"""Status vocabulary for a biometric update case.

Mirrors the `Facial_Update_Case_Status` enum declared in
fae-docs/09-microservices/services/05-biometric-service/data-model.md and the
values the HTTP contract already accepts (Pending / In_Review / Approved /
Rejected). Str-valued so JSON serialisation is unchanged for existing clients.
"""
from __future__ import annotations

from enum import Enum


class UpdateCaseStatus(str, Enum):
    PENDING = "Pending"
    IN_REVIEW = "In_Review"
    APPROVED = "Approved"
    REJECTED = "Rejected"

    @property
    def is_terminal(self) -> bool:
        """True for the decision states that stamp `reviewed_at`."""
        return self in (UpdateCaseStatus.APPROVED, UpdateCaseStatus.REJECTED)

    @classmethod
    def parse(cls, value: str) -> "UpdateCaseStatus":
        """Map a raw request value onto the enum without leaking ValueError."""
        for member in cls:
            if member.value == value:
                return member
        raise ValueError(f"unknown update case status: {value!r}")
