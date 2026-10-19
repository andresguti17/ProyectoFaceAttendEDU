"""Biometric match log — domain entity.

One record per 1:1 verify or 1:N identify attempt, kept as the security/audit
trail required by fae-docs/00-governance/security-rules.md (A09: security logs
retained for a minimum of 90 days) and as the durable form of the
`FacialVerificationSucceeded` / `FacialVerificationFailed` events listed in
SERVICE.md §5.

The collection is retention-bounded by a MongoDB TTL index (90 days), so these
documents expire by themselves and are never soft deleted.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

from domain.value_objects.biometric_type import BiometricType


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class BiometricMatchLog:
    biometric_type: BiometricType
    operation: str  # "VERIFY" | "IDENTIFY"
    matched: bool
    score: float
    threshold: float
    person_id: str | None = None
    matched_person_id: str | None = None
    finger_number: int | None = None
    embedding_id: str | None = None
    correlation_id: str | None = None
    log_id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=_utcnow)
