"""Domain policies for the raw-sample/image compute path — ported from
`10-ms-face-auth`'s `domain/policies.py`.

Cosine-based verify/identify (the pre-existing vector endpoints) have no
equivalent policy module — their threshold comparison is inline in the
routers. This module only covers what the merge adds: fingerprint sample
quality gating.
"""
from __future__ import annotations

MIN_FINGERPRINT_QUALITY = 30


def fingerprint_quality_ok(quality: int | None) -> bool:
    """Quality is optional by contract; reported but not blocking when absent."""
    if quality is None:
        return True
    return 0 <= quality <= 100 and quality >= MIN_FINGERPRINT_QUALITY
