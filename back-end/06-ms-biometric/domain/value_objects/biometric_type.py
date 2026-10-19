"""Biometric modality vocabulary.

Str-valued enum so the members serialise to the exact wire format the API
already exposes ("FACIAL" / "FINGERPRINT") — see SERVICE.md §4.
"""
from __future__ import annotations

from enum import Enum


class BiometricType(str, Enum):
    """Modality of a biometric template (ADR-003 / 06-data/domains/06-biometric.md)."""

    FACIAL = "FACIAL"
    FINGERPRINT = "FINGERPRINT"
