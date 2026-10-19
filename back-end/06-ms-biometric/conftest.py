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
