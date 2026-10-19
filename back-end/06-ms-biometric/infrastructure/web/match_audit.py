"""Match-attempt auditing shared by the facial and fingerprint routers.

Every 1:1 verify and 1:N identify that actually compares vectors leaves a
record in `biometric_match_logs` (security-rules.md A09: security logs retained
for at least 90 days; SERVICE.md §5: `FacialVerificationSucceeded` /
`FacialVerificationFailed`).

The write is deliberately **non-fatal**. By the time a comparison has produced a
score, the template read already succeeded, so failing the caller's request
because the audit insert failed would turn a successful authentication into an
error. The failure is logged with its stack trace instead of being swallowed,
which keeps it loud without corrupting the primary result.
"""
from __future__ import annotations

import logging

from domain.entities.match_log import BiometricMatchLog
from domain.ports.out.match_log_repository import MatchLogRepositoryPort

logger = logging.getLogger("biometric.audit")


async def record_match(
    repository: MatchLogRepositoryPort | None, entry: BiometricMatchLog
) -> None:
    """Append a match attempt; log and continue if the audit store rejects it."""
    if repository is None:
        logger.error(
            "Match log repository unavailable; dropping %s %s audit entry for person %s",
            entry.biometric_type.value,
            entry.operation,
            entry.person_id,
        )
        return
    try:
        await repository.record(entry)
    except Exception:  # noqa: BLE001 - intentional: audited, never fatal
        logger.exception(
            "Failed to persist %s %s match log for person %s (matched=%s, score=%.4f)",
            entry.biometric_type.value,
            entry.operation,
            entry.person_id,
            entry.matched,
            entry.score,
        )
