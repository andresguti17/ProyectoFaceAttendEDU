"""pytest configuration for `06-ms-biometric`.

Inserting the service root on `sys.path` is what lets tests import `main`,
`domain.*` and `infrastructure.*` as top-level packages — the service runs the
same way under uvicorn (`uvicorn main:app` from the service root), and it is not
installed as a distribution.
"""
from __future__ import annotations

import os
import sys

SERVICE_ROOT = os.path.dirname(os.path.abspath(__file__))
if SERVICE_ROOT not in sys.path:
    sys.path.insert(0, SERVICE_ROOT)

# Router contract tests exercise business behaviour, not the session guard;
# tests/unit/web/test_security.py turns the guard back on explicitly.
os.environ.setdefault("BIOMETRIC_AUTH_ENABLED", "false")

# Liveness tests feed placeholder frames (no real faces), so the same-person and
# minimum-step-time checks are off by default; the tests of those checks enable them.
os.environ.setdefault("BIOMETRIC_LIVENESS_IDENTITY_CHECK", "false")
os.environ.setdefault("BIOMETRIC_LIVENESS_MIN_STEP_SECONDS", "0")

# Ley 1581: the biometric-authorization check calls identity, so it is off by default
# here; tests/unit/web/test_ley1581.py turns it on. The encryption key is a test-only value.
os.environ.setdefault("BIOMETRIC_CONSENT_CHECK_ENABLED", "false")
# Terms/guardian enablement is also read from identity: off here, on in tests/unit/web/test_enablement.py.
os.environ.setdefault("BIOMETRIC_ENABLEMENT_CHECK_ENABLED", "false")
os.environ.setdefault("BIOMETRIC_ENCRYPTION_KEY", "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=")


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_process_caches():
    """The auth and school caches are per process: a test must not inherit another's answers."""
    from infrastructure.web import match_scope, security

    for cache in (
        security._session_cache,
        security._eval_cache,
        security._caller_school_cache,
        match_scope._match_allow_cache,
    ):
        cache.clear()
    yield
