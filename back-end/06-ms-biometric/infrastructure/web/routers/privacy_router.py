"""Deletion of a person's biometric data (Ley 1581 de 2012, art. 8-e).

When the holder revokes the authorization to process their biometric data, the
templates (face and fingerprint, every version) are hard-deleted and the match
logs keep no reference to the person. Identity records the revocation itself;
the apps call both. The holder may delete their own data; a reviewer only within
their school (same rule as the update cases).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from domain.ports.out.biometric_repository import BiometricRepositoryPort
from domain.ports.out.match_log_repository import MatchLogRepositoryPort
from infrastructure.config.dependencies import (
    get_facial_repository,
    get_fingerprint_repository,
    get_match_log_repository,
)
from infrastructure.web.security import ensure_can_touch_person, require_permission

router = APIRouter(
    tags=["biometric"],
    dependencies=[Depends(require_permission("biometric.case:request"))],
)


@router.delete("/api/v1/biometric/persons/{person_id}")
async def delete_person_biometrics(
    person_id: str,
    request: Request,
    facial_repository: BiometricRepositoryPort = Depends(get_facial_repository),
    fingerprint_repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
):
    await ensure_can_touch_person(request, person_id)
    faces = await facial_repository.purge(person_id)
    fingerprints = await fingerprint_repository.purge(person_id)
    logs = await match_logs.anonymize(person_id)
    return {
        "person_id": person_id,
        "deleted_face_templates": faces,
        "deleted_fingerprint_templates": fingerprints,
        "anonymized_match_logs": logs,
    }
