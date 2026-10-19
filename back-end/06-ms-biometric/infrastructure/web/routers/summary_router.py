"""Per-person biometric enrollment summary (primary adapter).

Replaces `10-ms-face-auth`'s `GET /api/users/{username}/exists`, which was a
username/identity-directory concept that doesn't apply here — this service is
person_id-keyed and has no notion of a username. Mounted at the bare
`/api/v1/biometric/{person_id}/summary` (not nested under `/facial` or
`/fingerprint`) since it reports on both modalities at once.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from domain.ports.out.biometric_repository import BiometricRepositoryPort
from infrastructure.config.dependencies import get_facial_repository, get_fingerprint_repository
from infrastructure.web.security import require_permission

router = APIRouter(
    tags=["biometric"],
    dependencies=[Depends(require_permission("attendance.record:write"))],
)


@router.get("/api/v1/biometric/{person_id}/summary")
async def biometric_summary(
    person_id: str,
    facial_repository: BiometricRepositoryPort = Depends(get_facial_repository),
    fingerprint_repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
):
    has_face = await facial_repository.find_active(person_id) is not None
    has_fingerprint = bool(await fingerprint_repository.list_active(person_id))
    return {"person_id": person_id, "has_face": has_face, "has_fingerprint": has_fingerprint}
