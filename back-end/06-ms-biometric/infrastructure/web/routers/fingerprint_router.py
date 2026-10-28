"""Fingerprint biometric endpoints (primary adapter).

Route prefix is fixed at `/api/v1/biometric/fingerprint` — see the note in
`facial_router.py` about the Kong route and the front-end client.

`/enroll-sample` and `/identify-sample` were ported from `10-ms-face-auth`
(merged and removed). Unlike the facial image path, a fingerprint sample has no
fixed-length vector representation in the source service: it kept the raw
sample and matched by counting OpenCV keypoint matches (SIFT/ORB), not cosine
similarity. That matching convention is kept as-is here rather than forced into
the `encoding: list[float]` + cosine model — see `domain/fingerprint_matching.py`
and `FingerprintEmbedding.raw_sample_b64`. The existing vector-based
`enroll`/`verify`/`identify` endpoints are unchanged and keep working for
callers that already have a computed encoding.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from domain.entities.fingerprint_embedding import FingerprintEmbedding
from domain.entities.match_log import BiometricMatchLog
from domain.fingerprint_decode import decode_fingerprint
from domain.fingerprint_matching import fingerprint_keypoint_score
from domain.policies import MIN_FINGERPRINT_QUALITY, fingerprint_quality_ok
from domain.ports.out.biometric_repository import BiometricRepositoryPort
from domain.ports.out.match_log_repository import MatchLogRepositoryPort
from domain.similarity import cosine
from domain.value_objects.biometric_type import BiometricType
from infrastructure.config.dependencies import (
    get_fingerprint_match_threshold,
    get_fingerprint_repository,
    get_match_log_repository,
    get_similarity_threshold,
    rate_limit,
)
from infrastructure.config.settings import Settings, get_settings
from infrastructure.web.match_audit import record_match
from infrastructure.web.security import require_permission
from infrastructure.web.schemas.responses import template_response

# Templates are sensitive: only roles that capture attendance (admin, instructor).
logger = logging.getLogger(__name__)

from infrastructure.web.match_scope import MatchScope, best_allowed, get_match_scope
from infrastructure.web.security import bearer_or_none, ensure_biometric_consent, ensure_staff_scope

router = APIRouter(
    prefix="/api/v1/biometric/fingerprint",
    tags=["fingerprint"],
    dependencies=[Depends(require_permission("attendance.record:write"))],
)

OPERATION_VERIFY = "VERIFY"
OPERATION_IDENTIFY = "IDENTIFY"
OPERATION_ENROLL = "ENROLL"
OPERATION_DELETE = "DELETE"
NO_ACTIVE_TEMPLATE = "no active fingerprint template"
NO_MATCH = "no match found"


def _actor_user_id(request: Request | None) -> str | None:
    """The authenticated user who made the call (audit: who enrolled a fingerprint)."""
    return str(getattr(getattr(request, "state", None), "user_id", "") or "") or None


def _correlation_id(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class EnrollFingerprintRequest(BaseModel):
    person_id: str = Field(min_length=1)
    finger_number: int = Field(ge=1, le=10)
    encoding: list[float] = Field(min_length=1)
    model_version: str = "fingerprint-v1"


class VerifyFingerprintRequest(BaseModel):
    person_id: str = Field(min_length=1)
    finger_number: int = Field(ge=1, le=10)
    encoding: list[float] = Field(min_length=1)


class IdentifyFingerprintRequest(BaseModel):
    encoding: list[float] = Field(min_length=1)
    finger_number: int | None = Field(default=None, ge=1, le=10)


class EnrollFingerprintSampleRequest(BaseModel):
    person_id: str = Field(min_length=1)
    finger_number: int = Field(ge=1, le=10)
    sample_format: int | None = None
    data_base64: str = Field(min_length=1)
    quality: int | None = Field(default=None, ge=0, le=100)
    model_version: str = "fingerprint-sift-v1"


class IdentifyFingerprintSampleRequest(BaseModel):
    sample_format: int | None = None
    data_base64: str = Field(min_length=1)
    quality: int | None = Field(default=None, ge=0, le=100)
    finger_number: int | None = Field(default=None, ge=1, le=10)


@router.post("/enroll", status_code=status.HTTP_201_CREATED)
async def enroll_fingerprint(
    req: EnrollFingerprintRequest,
    repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
    request: Request = None,
):
    if request is not None:
        await ensure_biometric_consent(req.person_id, bearer_or_none(request))
    template = FingerprintEmbedding(
        person_id=req.person_id,
        finger_number=req.finger_number,
        encoding=req.encoding,
        model_version=req.model_version,
    )
    stored = await repository.enroll(template)
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FINGERPRINT,
            operation=OPERATION_ENROLL,
            matched=True,
            score=1.0,
            threshold=0.0,
            person_id=req.person_id,
            finger_number=req.finger_number,
            embedding_id=stored.embedding_id,
            correlation_id=_correlation_id(request) if request is not None else None,
            actor_user_id=_actor_user_id(request),
        ),
    )
    return template_response(stored)


@router.get("/{person_id}")
async def list_fingerprints(
    person_id: str,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
):
    await ensure_staff_scope(request, person_id)
    templates = await repository.list_active(person_id)
    return {"templates": [template_response(template) for template in templates]}


@router.get("/{person_id}/{finger}")
async def get_fingerprint(
    person_id: str,
    finger: int,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
):
    await ensure_staff_scope(request, person_id)
    active = await repository.find_active(person_id, finger)
    if active is None:
        raise HTTPException(status_code=404, detail=NO_ACTIVE_TEMPLATE)
    return template_response(active)


@router.delete("/{person_id}/{finger}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fingerprint(
    person_id: str,
    finger: int,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
):
    await ensure_staff_scope(request, person_id)
    # Soft delete: the document stays, is_active goes false and deleted_at is set.
    if not await repository.deactivate(person_id, finger):
        raise HTTPException(status_code=404, detail=NO_ACTIVE_TEMPLATE)
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FINGERPRINT,
            operation=OPERATION_DELETE,
            matched=False,
            score=0.0,
            threshold=0.0,
            person_id=person_id,
            finger_number=finger,
            correlation_id=_correlation_id(request),
        ),
    )
    return None


@router.post("/verify")
async def verify_fingerprint(
    req: VerifyFingerprintRequest,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
    threshold: float = Depends(get_similarity_threshold),
    match_scope: MatchScope = Depends(get_match_scope),
):
    # A person of another school answers like one without a template: no existence oracle.
    if not await match_scope.allows(req.person_id):
        raise HTTPException(status_code=404, detail=NO_ACTIVE_TEMPLATE)
    active = await repository.find_active(req.person_id, req.finger_number)
    if active is None:
        raise HTTPException(status_code=404, detail=NO_ACTIVE_TEMPLATE)

    score = cosine(req.encoding, list(active.encoding))
    matched = score >= threshold
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FINGERPRINT,
            operation=OPERATION_VERIFY,
            matched=matched,
            score=score,
            threshold=threshold,
            person_id=req.person_id,
            matched_person_id=req.person_id if matched else None,
            finger_number=req.finger_number,
            embedding_id=active.embedding_id,
            correlation_id=_correlation_id(request),
        ),
    )
    return {"match": matched, "score": score}


@router.post("/identify")
async def identify_fingerprint(
    req: IdentifyFingerprintRequest,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
    threshold: float = Depends(get_similarity_threshold),
    match_scope: MatchScope = Depends(get_match_scope),
):
    scored: list[tuple[float, FingerprintEmbedding]] = []
    # One active template per (person, finger) is guaranteed by the unique
    # partial index; the guard keeps the result deterministic if it is missing.
    seen: set[tuple[str, int]] = set()
    for template in await repository.list_active(finger_number=req.finger_number):
        key = (template.person_id, template.finger_number)
        if key in seen:
            continue
        seen.add(key)
        scored.append((cosine(req.encoding, list(template.encoding)), template))
    # Only a person the caller's scope allows can match (see `match_scope`).
    best, best_score = await best_allowed(scored, threshold, match_scope)
    best_score = max(best_score, 0.0)

    matched = best is not None
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FINGERPRINT,
            operation=OPERATION_IDENTIFY,
            matched=matched,
            score=best_score,
            threshold=threshold,
            matched_person_id=best.person_id if matched else None,
            finger_number=req.finger_number,
            embedding_id=best.embedding_id if matched and best is not None else None,
            correlation_id=_correlation_id(request),
        ),
    )
    if not matched:
        raise HTTPException(status_code=404, detail=NO_MATCH)
    return {
        "person_id": best.person_id,
        "finger_number": best.finger_number,
        "score": best_score,
    }


def _raw_sample_candidates(
    templates: list[FingerprintEmbedding],
) -> list[FingerprintEmbedding]:
    """Vector-based templates (`encoding` populated) have no raw sample to
    keypoint-match against — the two matching conventions never cross."""
    return [template for template in templates if template.raw_sample_b64 is not None]


@router.post(
    "/enroll-sample",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("enroll_fingerprint"))],
)
async def enroll_fingerprint_sample(
    req: EnrollFingerprintSampleRequest,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
    fp_threshold: int = Depends(get_fingerprint_match_threshold),
    settings: Settings = Depends(get_settings),
):
    await ensure_biometric_consent(req.person_id, bearer_or_none(request))
    if not fingerprint_quality_ok(req.quality):
        logger.warning(
            "enroll-sample refused: quality %s below the minimum %s", req.quality, MIN_FINGERPRINT_QUALITY
        )
        raise HTTPException(status_code=400, detail="Fingerprint sample quality too low")
    try:
        query_image = decode_fingerprint(
            req.data_base64, settings.max_image_bytes, settings.max_image_pixels
        )
    except ValueError as exc:
        logger.warning("enroll-sample refused: %s (format=%s)", exc, req.sample_format)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # O(active raw-sample records) keypoint-matching calls — the same cost
    # profile 10-ms-face-auth already had for this dedup check; not optimized
    # here, see domain/fingerprint_matching.py.
    candidates = _raw_sample_candidates(await repository.list_active())
    for candidate in candidates:
        if candidate.person_id == req.person_id:
            continue
        try:
            stored_image = decode_fingerprint(
                candidate.raw_sample_b64, settings.max_image_bytes, settings.max_image_pixels
            )
        except ValueError:
            continue
        if fingerprint_keypoint_score(query_image, stored_image) >= fp_threshold:
            raise HTTPException(
                status_code=409,
                detail="This fingerprint is already enrolled for a different person",
            )

    template = await repository.enroll(
        FingerprintEmbedding(
            person_id=req.person_id,
            finger_number=req.finger_number,
            encoding=[],
            model_version=req.model_version,
            raw_sample_b64=req.data_base64,
            sample_format=req.sample_format,
        )
    )
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FINGERPRINT,
            operation=OPERATION_ENROLL,
            matched=True,
            score=float(fp_threshold),
            threshold=float(fp_threshold),
            person_id=req.person_id,
            finger_number=req.finger_number,
            embedding_id=template.embedding_id,
            correlation_id=_correlation_id(request),
            actor_user_id=_actor_user_id(request),
        ),
    )
    return template_response(template)


@router.post("/identify-sample", dependencies=[Depends(rate_limit("identify_fingerprint"))])
async def identify_fingerprint_sample(
    req: IdentifyFingerprintSampleRequest,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_fingerprint_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
    fp_threshold: int = Depends(get_fingerprint_match_threshold),
    settings: Settings = Depends(get_settings),
    match_scope: MatchScope = Depends(get_match_scope),
):
    try:
        query_image = decode_fingerprint(
            req.data_base64, settings.max_image_bytes, settings.max_image_pixels
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    scored: list[tuple[int, FingerprintEmbedding]] = []
    candidates = _raw_sample_candidates(await repository.list_active(finger_number=req.finger_number))
    for candidate in candidates:
        try:
            stored_image = decode_fingerprint(
                candidate.raw_sample_b64, settings.max_image_bytes, settings.max_image_pixels
            )
        except ValueError:
            continue
        scored.append((fingerprint_keypoint_score(query_image, stored_image), candidate))
    # Only a person the caller's scope allows can match (see `match_scope`).
    best, best_score = await best_allowed(scored, fp_threshold, match_scope)

    matched = best is not None
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FINGERPRINT,
            operation=OPERATION_IDENTIFY,
            matched=matched,
            score=float(best_score),
            threshold=float(fp_threshold),
            matched_person_id=best.person_id if matched and best is not None else None,
            finger_number=req.finger_number,
            embedding_id=best.embedding_id if matched and best is not None else None,
            correlation_id=_correlation_id(request),
        ),
    )
    if not matched or best is None:
        raise HTTPException(status_code=404, detail=NO_MATCH)
    return {
        "person_id": best.person_id,
        "finger_number": best.finger_number,
        "score": best_score,
    }
