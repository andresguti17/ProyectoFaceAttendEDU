"""Persistence failure types.

The service has **no in-memory fallback**: when MongoDB is misconfigured or
unreachable, the request fails with one of these and `main.py` turns it into an
explicit 503. Silently degrading to process memory would return answers that
look correct while persisting nothing.
"""
from __future__ import annotations


class PersistenceError(RuntimeError):
    """Base class for every failure raised by a persistence adapter."""


class PersistenceUnavailableError(PersistenceError):
    """MongoDB is disabled or not connected, so the request cannot be served."""


class ConcurrencyConflictError(PersistenceError):
    """A uniqueness invariant was violated by a concurrent write."""
