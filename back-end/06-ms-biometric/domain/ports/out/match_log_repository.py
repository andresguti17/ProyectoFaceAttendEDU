"""Secondary (driven) port: biometric match log persistence.

Append-only audit trail of verify/identify attempts. Retention is enforced by
the store (MongoDB TTL index, 90 days per
fae-docs/00-governance/security-rules.md A09), not by callers.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from domain.entities.match_log import BiometricMatchLog


class MatchLogRepositoryPort(ABC):
    @abstractmethod
    async def record(self, entry: BiometricMatchLog) -> None:
        """Append one match attempt. Implementations must not raise for a missing document."""
