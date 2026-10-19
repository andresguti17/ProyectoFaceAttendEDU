"""Facial biometric endpoints (primary adapter).

Route prefix is fixed at `/api/v1/biometric/facial` because the API gateway
(`back-end/99-api-gateway/kong/kong.yml`, route `biometric-route`) forwards
`/api/v1/biometric` to this service with `strip_path: false`, and
`front-end/Web/src/api/endpoints.ts` calls the full prefixed path.

Liveness + image-based enroll/identify (`/liveness-challenge`, `/liveness-step`,
`/enroll-image`, `/identify-image`) were ported from `10-ms-face-auth` (merged
and removed): that service computed encodings from raw images itself; this
router is what gives `06-ms-biometric` the same capability, feeding straight
into the existing vector-based `enroll`/`identify` storage and matching so
there is exactly one facial template model, not two. Deliberately placed under
this prefix rather than the source's bare `/api/face/...` — there is no
separate face-auth path anymore.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from domain.entities.facial_embedding import FacialEmbedding
from domain.entities.match_log import BiometricMatchLog
from domain.face_encoding import decode_image, face_encoding, validate_liveness
from domain.ports.out.biometric_repository import BiometricRepositoryPort
from domain.ports.out.match_log_repository import MatchLogRepositoryPort
from domain.similarity import cosine
from domain.value_objects.biometric_type import BiometricType
from infrastructure.config.dependencies import (
    get_facial_repository,
    get_liveness_secret,
    get_match_log_repository,
    get_similarity_threshold,
    rate_limit,
)
from infrastructure.config.settings import Settings, get_settings
from infrastructure.web.liveness import (
    advance_liveness_challenge,
    consume_liveness_challenge,
    create_liveness_challenge,
    verify_liveness_challenge,
)
from infrastructure.web.match_audit import record_match
from infrastructure.web.security import STAFF_PERMISSION, ensure_can_enroll, require_permission
from infrastructure.web.schemas.responses import template_response

# Templates are sensitive: only roles that capture attendance (admin, instructor).
# Every role may pass liveness and enroll its own face (checked in /enroll-image).
router = APIRouter(prefix="/api/v1/biometric/facial", tags=["facial"])
STAFF = Depends(require_permission(STAFF_PERMISSION))
ANY_ROLE = Depends(require_permission("biometric.case:request"))

OPERATION_VERIFY = "VERIFY"
OPERATION_IDENTIFY = "IDENTIFY"
OPERATION_ENROLL = "ENROLL"
OPERATION_DELETE = "DELETE"
OPERATION_LIVENESS_FAILURE = "LIVENESS_FAILURE"
NO_ACTIVE_TEMPLATE = "no active facial template"
NO_MATCH = "no match found"
FRAMES_PER_ACTION = 6


def _correlation_id(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class EnrollFacialRequest(BaseModel):
    person_id: str = Field(min_length=1)
    encoding: list[float] = Field(min_length=1)
    model_version: str = "facenet-v1"


class VerifyFacialRequest(BaseModel):
    person_id: str = Field(min_length=1)
    encoding: list[float] = Field(min_length=1)


class IdentifyFacialRequest(BaseModel):
    encoding: list[float] = Field(min_length=1)


class LivenessStepRequest(BaseModel):
    challenge_token: str = Field(min_length=1)
    action_index: int = Field(ge=0)
    images: list[str] = Field(min_length=FRAMES_PER_ACTION, max_length=FRAMES_PER_ACTION)


class EnrollFacialImageRequest(BaseModel):
    person_id: str = Field(min_length=1)
    image_base64: str = Field(min_length=1)
    challenge_token: str = Field(min_length=1)
    model_version: str = "facenet-v1"


class IdentifyFacialImageRequest(BaseModel):
    image_base64: str = Field(min_length=1)
    challenge_token: str = Field(min_length=1)


async def _best_facial_match(
    encoding: list[float],
    repository: BiometricRepositoryPort,
    threshold: float,
    exclude_person_id: str | None = None,
) -> tuple[FacialEmbedding | None, float]:
    """Shared 1:N cosine scan used by `/identify`, `/identify-image`, and the
    `/enroll-image` duplicate-face check."""
    best: FacialEmbedding | None = None
    best_score = 0.0
    seen: set[str] = set()
    for template in await repository.list_active():
        if template.person_id in seen:
            continue
        seen.add(template.person_id)
        if exclude_person_id is not None and template.person_id == exclude_person_id:
            continue
        score = cosine(encoding, list(template.encoding))
        if score > best_score:
            best_score = score
            best = template
    matched = best is not None and best_score >= threshold
    return (best, best_score) if matched else (None, best_score)


@router.post("/enroll", status_code=status.HTTP_201_CREATED, dependencies=[STAFF])
async def enroll_facial(
    req: EnrollFacialRequest,
    repository: BiometricRepositoryPort = Depends(get_facial_repository),
):
    template = FacialEmbedding(
        person_id=req.person_id,
        encoding=req.encoding,
        model_version=req.model_version,
    )
    return template_response(await repository.enroll(template))


@router.get("/liveness-challenge", dependencies=[ANY_ROLE])
async def liveness_challenge(
    actions: int = 3,
    secret: str = Depends(get_liveness_secret),
    settings: Settings = Depends(get_settings),
):
    if actions not in (2, 3):
        raise HTTPException(status_code=422, detail="actions must be 2 or 3")
    token, action_list = create_liveness_challenge(secret, settings.liveness_ttl_seconds, actions)
    return {"challenge_token": token, "actions": action_list}


# Literal routes (liveness-challenge above) MUST be registered before
# /{person_id}: FastAPI matches path operations in declaration order, and a
# GET /{person_id} declared first would swallow GET /liveness-challenge,
# treating "liveness-challenge" as a person_id. Confirmed by actually hitting
# this 404 in a real test run before reordering.
@router.get("/{person_id}", dependencies=[STAFF])
async def get_facial(
    person_id: str,
    repository: BiometricRepositoryPort = Depends(get_facial_repository),
):
    active = await repository.find_active(person_id)
    if active is None:
        raise HTTPException(status_code=404, detail=NO_ACTIVE_TEMPLATE)
    return template_response(active)


@router.get("/{person_id}/history", dependencies=[STAFF])
async def facial_history(
    person_id: str,
    repository: BiometricRepositoryPort = Depends(get_facial_repository),
):
    history = await repository.list_history(person_id)
    return {"history": [template_response(template) for template in history]}


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[STAFF])
async def delete_facial(
    person_id: str,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_facial_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
):
    # Soft delete: the document stays, is_active goes false and deleted_at is set.
    # Covers both "revoke template" and "delete subject" from the merged
    # 10-ms-face-auth lifecycle endpoints — there is no identity left to keep
    # separate from the template once that service's own person/app_user layer
    # is gone, so both collapse onto this one soft-deactivate.
    if not await repository.deactivate(person_id):
        raise HTTPException(status_code=404, detail=NO_ACTIVE_TEMPLATE)
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FACIAL,
            operation=OPERATION_DELETE,
            matched=False,
            score=0.0,
            threshold=0.0,
            person_id=person_id,
            correlation_id=_correlation_id(request),
        ),
    )
    return None


@router.post("/verify", dependencies=[STAFF])
async def verify_facial(
    req: VerifyFacialRequest,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_facial_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
    threshold: float = Depends(get_similarity_threshold),
):
    active = await repository.find_active(req.person_id)
    if active is None:
        raise HTTPException(status_code=404, detail=NO_ACTIVE_TEMPLATE)

    score = cosine(req.encoding, list(active.encoding))
    matched = score >= threshold
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FACIAL,
            operation=OPERATION_VERIFY,
            matched=matched,
            score=score,
            threshold=threshold,
            person_id=req.person_id,
            matched_person_id=req.person_id if matched else None,
            embedding_id=active.embedding_id,
            correlation_id=_correlation_id(request),
        ),
    )
    return {"match": matched, "score": score}


@router.post("/identify", dependencies=[STAFF])
async def identify_facial(
    req: IdentifyFacialRequest,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_facial_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
    threshold: float = Depends(get_similarity_threshold),
):
    best, best_score = await _best_facial_match(req.encoding, repository, threshold)
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FACIAL,
            operation=OPERATION_IDENTIFY,
            matched=best is not None,
            score=best_score,
            threshold=threshold,
            matched_person_id=best.person_id if best is not None else None,
            embedding_id=best.embedding_id if best is not None else None,
            correlation_id=_correlation_id(request),
        ),
    )
    if best is None:
        raise HTTPException(status_code=404, detail=NO_MATCH)
    return {"person_id": best.person_id, "score": best_score}


@router.post("/liveness-step", dependencies=[ANY_ROLE, Depends(rate_limit("liveness_step"))])
async def liveness_step(
    req: LivenessStepRequest,
    request: Request,
    secret: str = Depends(get_liveness_secret),
    settings: Settings = Depends(get_settings),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
):
    try:
        actions, step = verify_liveness_challenge(secret, req.challenge_token)
        if req.action_index != step:
            raise ValueError("action_index does not match the current challenge step")
        images = [
            decode_image(image, settings.max_image_bytes, settings.max_image_pixels)
            for image in req.images
        ]
        completed_gesture = validate_liveness(images, actions[req.action_index])
    except (ValueError, IndexError) as exc:
        await record_match(
            match_logs,
            BiometricMatchLog(
                biometric_type=BiometricType.FACIAL,
                operation=OPERATION_LIVENESS_FAILURE,
                matched=False,
                score=0.0,
                threshold=0.0,
                correlation_id=_correlation_id(request),
            ),
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not completed_gesture:
        await record_match(
            match_logs,
            BiometricMatchLog(
                biometric_type=BiometricType.FACIAL,
                operation=OPERATION_LIVENESS_FAILURE,
                matched=False,
                score=0.0,
                threshold=0.0,
                correlation_id=_correlation_id(request),
            ),
        )
        raise HTTPException(status_code=400, detail="Liveness gesture not detected")
    try:
        next_token, _, next_step = advance_liveness_challenge(
            secret, settings.liveness_ttl_seconds, req.challenge_token
        )
    except ValueError as exc:
        # Genuine replay of an already-advanced token (not just a validation
        # failure above) — still a 400, never an unhandled 500.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"challenge_token": next_token, "completed": next_step >= len(actions)}


@router.post(
    "/enroll-image", status_code=status.HTTP_201_CREATED, dependencies=[ANY_ROLE, Depends(rate_limit("enroll_face"))]
)
async def enroll_facial_image(
    req: EnrollFacialImageRequest,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_facial_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
    threshold: float = Depends(get_similarity_threshold),
    secret: str = Depends(get_liveness_secret),
    settings: Settings = Depends(get_settings),
):
    # Before consuming the challenge, so a refused caller does not burn it.
    active = await repository.find_active(req.person_id)
    await ensure_can_enroll(request, req.person_id, getattr(active, "enrolled_at", None), active is not None)
    try:
        consume_liveness_challenge(secret, req.challenge_token)
        image = decode_image(req.image_base64, settings.max_image_bytes, settings.max_image_pixels)
        encoding = face_encoding(image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if encoding is None:
        raise HTTPException(status_code=400, detail="No face found in the image")

    duplicate, duplicate_score = await _best_facial_match(
        encoding, repository, threshold, exclude_person_id=req.person_id
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail=f"This face is already enrolled for a different person (score={duplicate_score:.4f})",
        )

    template = await repository.enroll(
        FacialEmbedding(person_id=req.person_id, encoding=encoding, model_version=req.model_version)
    )
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FACIAL,
            operation=OPERATION_ENROLL,
            matched=True,
            score=1.0,
            threshold=threshold,
            person_id=req.person_id,
            embedding_id=template.embedding_id,
            correlation_id=_correlation_id(request),
        ),
    )
    return template_response(template)


@router.post("/identify-image", dependencies=[STAFF, Depends(rate_limit("identify_face"))])
async def identify_facial_image(
    req: IdentifyFacialImageRequest,
    request: Request,
    repository: BiometricRepositoryPort = Depends(get_facial_repository),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository),
    threshold: float = Depends(get_similarity_threshold),
    secret: str = Depends(get_liveness_secret),
    settings: Settings = Depends(get_settings),
):
    try:
        consume_liveness_challenge(secret, req.challenge_token)
        image = decode_image(req.image_base64, settings.max_image_bytes, settings.max_image_pixels)
        encoding = face_encoding(image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if encoding is None:
        raise HTTPException(status_code=400, detail="No face found in the image")

    best, best_score = await _best_facial_match(encoding, repository, threshold)
    await record_match(
        match_logs,
        BiometricMatchLog(
            biometric_type=BiometricType.FACIAL,
            operation=OPERATION_IDENTIFY,
            matched=best is not None,
            score=best_score,
            threshold=threshold,
            matched_person_id=best.person_id if best is not None else None,
            embedding_id=best.embedding_id if best is not None else None,
            correlation_id=_correlation_id(request),
        ),
    )
    if best is None:
        raise HTTPException(status_code=404, detail=NO_MATCH)
    return {"person_id": best.person_id, "score": best_score}
