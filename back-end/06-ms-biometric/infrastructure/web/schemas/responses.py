"""Entity -> JSON response mapping (primary adapter).

Kept separate from the domain so entities stay free of HTTP concerns, and
separate from the persistence mappers so the wire format can evolve without
touching the stored document shape.

The field names and value formats below are the contract the existing clients
(`front-end/Web/src/api/endpoints.ts`, SERVICE.md §4) already consume; changes
here must stay additive.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from domain.entities.biometric_template import BiometricTemplate
from domain.entities.update_case import BiometricUpdateCase


def iso(value: datetime | None) -> str | None:
    """ISO-8601 with UTC offset, matching the format this API has always returned."""
    return None if value is None else value.isoformat()


def template_response(template: BiometricTemplate) -> dict[str, Any]:
    """Common projection for both modalities; adds `finger_number` when present."""
    payload: dict[str, Any] = {
        "_id": template.embedding_id,
        "person_id": template.person_id,
        "encoding": list(template.encoding),
        "model_version": template.model_version,
        "template_version": template.template_version,
        "enrolled_at": iso(template.enrolled_at),
        "is_active": template.is_active,
    }
    finger_number = getattr(template, "finger_number", None)
    if finger_number is not None:
        payload["finger_number"] = finger_number
    # Raw-sample fingerprint records (ported from 10-ms-face-auth) have no
    # vector `encoding` — surface the sample fields so clients can tell the two
    # kinds of record apart.
    raw_sample_b64 = getattr(template, "raw_sample_b64", None)
    if raw_sample_b64 is not None:
        payload["raw_sample_b64"] = raw_sample_b64
        payload["sample_format"] = getattr(template, "sample_format", None)
    return payload


def update_case_response(case: BiometricUpdateCase) -> dict[str, Any]:
    return {
        "request_id": case.request_id,
        "person_id": case.person_id,
        "biometric_type": case.biometric_type.value,
        "reason": case.reason,
        "status": case.status.value,
        "requested_at": iso(case.requested_at),
        "reviewed_at": iso(case.reviewed_at),
    }
