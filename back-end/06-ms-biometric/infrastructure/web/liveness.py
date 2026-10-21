"""Liveness challenge tokens — ported from `10-ms-face-auth`'s
`infrastructure/web/auth.py`, stripped of everything session/JWT-related.

This was never a JWT: it is a hand-rolled, HMAC-SHA256-signed, base64url
payload `{actions, step, exp}`, single-use per step (anti-replay via a
process-wide consumed-token set — same single-process caveat the source
service already documented; not addressed here). Verifying it requires no
network call and no shared secret with any other service — `settings.
liveness_challenge_secret` is independent of ms-identity's session/JWT secrets.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets as _secrets
import time

# "turn" is the legacy direction-less gesture: only clients that do not announce
# which gestures they support (see `create_liveness_challenge`) keep receiving it.
LEGACY_ACTIONS = ("blink", "turn", "open_mouth")
LIVENESS_ACTIONS = LEGACY_ACTIONS + ("turn_left", "turn_right", "smile", "nod")

_consumed_tokens: set[str] = set()
# Face seen at the first step of each challenge (`challenge id -> (expiry, encoding)`),
# kept in memory only for the challenge TTL so later steps and the final image can
# be checked to be the same person. Never logged, never persisted.
_identities: dict[str, tuple[float, list[float]]] = {}
_last_actions: tuple[str, ...] | None = None


def _prune_consumed_tokens(max_size: int = 10_000) -> None:
    if len(_consumed_tokens) > max_size:
        _consumed_tokens.clear()


def create_liveness_challenge(
    secret: str,
    ttl_seconds: int,
    num_actions: int = 3,
    allowed: tuple[str, ...] | list[str] | None = None,
) -> tuple[str, list[str]]:
    """A challenge with `num_actions` random gestures (1 = enroll, 2-3 = stricter).

    The subset and order are randomized every time: a fixed recorded sequence
    does not work even if the possible gestures are public knowledge.
    `allowed` is what the calling client can render (default: the legacy set).
    """
    global _last_actions
    if num_actions not in (1, 2, 3):
        raise ValueError("num_actions must be 1, 2 or 3")
    randomizer = _secrets.SystemRandom()
    pool = [action for action in (allowed or LEGACY_ACTIONS) if action in LIVENESS_ACTIONS]
    if len(set(pool)) < num_actions:
        raise ValueError("Not enough supported liveness gestures")
    actions = randomizer.sample(sorted(set(pool)), num_actions)
    randomizer.shuffle(actions)
    if tuple(actions) == _last_actions:
        randomizer.shuffle(actions)  # avoid repeating the exact previous sequence
    _last_actions = tuple(actions)
    return _create_token(secret, ttl_seconds, actions, 0, _secrets.token_hex(8)), actions


def verify_liveness_challenge(
    secret: str, token: str, require_complete: bool = False
) -> tuple[list[str], int]:
    payload = _verified_payload(secret, token, require_complete)
    return payload["actions"], payload["step"]


def liveness_claims(secret: str, token: str) -> tuple[str | None, float | None]:
    """(challenge id, issue time) of a valid token; `None`s for tokens without them."""
    payload = _verified_payload(secret, token)
    return payload.get("cid"), payload.get("iat")


def _verified_payload(secret: str, token: str, require_complete: bool = False) -> dict:
    try:
        encoded_text, signature_text = token.split(".", 1)
        encoded = encoded_text.encode()
        expected = hmac.new(secret.encode(), encoded, hashlib.sha256).digest()
        signature = _decode_base64url(signature_text)
        if not hmac.compare_digest(expected, signature):
            raise ValueError("Invalid liveness challenge")
        payload = json.loads(_decode_base64url(encoded_text).decode())
        actions = payload["actions"]
        step = payload["step"]
        valid = (
            isinstance(actions, list)
            and len(actions) in (1, 2, 3)
            and len(set(actions)) == len(actions)
            and set(actions) <= set(LIVENESS_ACTIONS)
        )
        if payload["exp"] < time.time() or not valid or step not in range(len(actions) + 1):
            raise ValueError("Liveness challenge expired or invalid")
        if require_complete and step != len(actions):
            raise ValueError("Liveness challenge not completed")
        return payload
    except (KeyError, TypeError, json.JSONDecodeError) as exc:
        # `ValueError`s raised intentionally above (expired/incomplete) propagate
        # with their own message; only malformed-token errors land here.
        raise ValueError("Invalid liveness challenge") from exc


def advance_liveness_challenge(
    secret: str, ttl_seconds: int, token: str
) -> tuple[str, list[str], int]:
    if token in _consumed_tokens:
        raise ValueError("Liveness step already used")
    actions, step = verify_liveness_challenge(secret, token)
    _consumed_tokens.add(token)
    _prune_consumed_tokens()
    next_step = step + 1
    cid, _ = liveness_claims(secret, token)
    return _create_token(secret, ttl_seconds, actions, next_step, cid), actions, next_step


def consume_liveness_challenge(secret: str, token: str) -> list[str]:
    if token in _consumed_tokens:
        raise ValueError("Liveness challenge already used")
    actions, _ = verify_liveness_challenge(secret, token, require_complete=True)
    _consumed_tokens.add(token)
    _prune_consumed_tokens()
    return actions


def remember_identity(challenge_id: str, encoding: list[float], ttl_seconds: int) -> None:
    now = time.time()
    for key in [key for key, (expiry, _) in _identities.items() if expiry < now]:
        del _identities[key]
    _identities[challenge_id] = (now + ttl_seconds, encoding)


def reference_identity(challenge_id: str | None) -> list[float] | None:
    entry = _identities.get(challenge_id) if challenge_id else None
    if entry is None or entry[0] < time.time():
        return None
    return entry[1]


def forget_identity(challenge_id: str | None) -> None:
    if challenge_id:
        _identities.pop(challenge_id, None)


def _create_token(
    secret: str, ttl_seconds: int, actions: list[str], step: int, challenge_id: str | None = None
) -> str:
    # `nonce` guarantees two tokens are never byte-identical even when actions,
    # step and exp (second granularity) all happen to coincide — without it,
    # two unrelated liveness attempts issued in the same second with the same
    # random action order would produce the same signed token, and consuming
    # one would silently consume the other too. Confirmed by actually hitting
    # this collision in a real test run (tests fired several challenges per
    # second, well within the 3-action/2-permutation action space).
    payload = {
        "actions": actions,
        "step": step,
        "exp": int(time.time()) + ttl_seconds,
        "iat": time.time(),
        "cid": challenge_id,
        "nonce": _secrets.token_hex(8),
    }
    encoded = _encode_payload(payload)
    signature = hmac.new(secret.encode(), encoded, hashlib.sha256).digest()
    return f"{encoded.decode()}.{_base64url(signature)}"


def _encode_payload(payload: dict) -> bytes:
    return _base64url(json.dumps(payload, separators=(",", ":")).encode()).encode()


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def _decode_base64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
