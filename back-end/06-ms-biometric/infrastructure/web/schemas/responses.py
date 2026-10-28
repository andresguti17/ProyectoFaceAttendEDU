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
    """Common projection for both modalities; adds `finger_number` when present.

    Metadata only: the vector (`encoding`) and the raw fingerprint sample are never returned.
    They are the biometric itself (Ley 1581, sensitive data), no client needs them back and
    a copy that leaves through the API cannot be revoked. Matching happens on the server.
    """
    payload: dict[str, Any] = {
        "_id": template.embedding_id,
        "person_id": template.person_id,
        "model_version": template.model_version,
        "template_version": template.template_version,
        "enrolled_at": iso(template.enrolled_at),
        "is_active": template.is_active,
    }
    finger_number = getattr(template, "finger_number", None)
    if finger_number is not None:
        payload["finger_number"] = finger_number
    # Raw-sample fingerprint records (ported from 10-ms-face-auth) carry a sample instead of a
    # vector: say which kind it is, never the sample.
    if getattr(template, "raw_sample_b64", None) is not None:
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
