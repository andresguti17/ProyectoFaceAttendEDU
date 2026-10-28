"""Which people a caller may identify or verify (a 1:N search must not cross schools).

The templates carry no school, so the search itself still runs over all of them; what changes is
the answer. Among the candidates that clear the threshold, best score first, the first one that
belongs to the caller's school wins. When none does, the answer is the same "no match" as for a
face that was never enrolled: a caller learns nothing about other schools. A look-alike of
another school therefore cannot hide the right person of the caller's own school.

Super Administrador (and a deployment with auth off) is unrestricted. A caller without an
academic actor matches nobody: fail secure, never "everyone".
"""
from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any, TypeVar

from fastapi import Request

from infrastructure.web import security

logger = logging.getLogger("biometric.match_scope")

T = TypeVar("T")

# Candidates above the threshold whose school is looked up, best first. A face is normally one
# person; this only bounds the work (one academic lookup each, cached) in degenerate data.
MAX_CANDIDATES = 5

_match_allow_cache: dict[tuple[str, str], tuple[bool, float]] = {}


class MatchScope:
    """`sees_all`: Super Administrador or auth off. Otherwise `school_id` is the caller's school."""

    __slots__ = ("sees_all", "school_id", "token")

    def __init__(self, sees_all: bool = True, school_id: str | None = None, token: str | None = None) -> None:
        self.sees_all = sees_all
        self.school_id = school_id
        self.token = token

    async def allows(self, person_id: str) -> bool:
        if self.sees_all:
            return True
        if self.school_id is None or not self.token:
            return False
        key = (self.school_id, person_id)
        cached = security._cache_get(_match_allow_cache, key)
        if cached is not None:
            return cached
        # Raises 503 when academic cannot be reached: an explicit failure, never a silent match.
        person_school = await security.resolve_person_school(person_id, self.token)
        allowed = person_school == self.school_id
        security._cache_store(_match_allow_cache, key, allowed)
        return allowed


UNRESTRICTED = MatchScope()


async def get_match_scope(request: Request) -> MatchScope:
    """REST dependency: the scope of the authenticated caller (the route already proved the role)."""
    if not security.get_settings().auth_enabled:
        return UNRESTRICTED
    token = security.bearer_or_none(request)
    user_id = str(getattr(request.state, "user_id", "") or "")
    if not token or not user_id:
        return MatchScope(sees_all=False, school_id=None, token=token)
    sees_all, school_id = await security.resolve_caller_school(user_id, token)
    return MatchScope(sees_all, school_id, token)


async def best_allowed(
    scored: Sequence[tuple[float, T]], threshold: float, scope: MatchScope
) -> tuple[T | None, Any]:
    """`(template, score)` of the best candidate at or above `threshold` the caller may see.

    `scored` is every `(score, template)` of the scan. When nothing qualifies the template is
    `None` and the score is the best raw score, which is only for the server-side audit log.
    """
    best_overall = max((score for score, _ in scored), default=0)
    qualifying = sorted((item for item in scored if item[0] >= threshold), key=lambda item: -item[0])
    for score, template in qualifying[:MAX_CANDIDATES]:
        if await scope.allows(template.person_id):
            return template, score
    return None, best_overall
