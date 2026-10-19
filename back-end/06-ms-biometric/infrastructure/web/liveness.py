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

LIVENESS_ACTIONS = ("blink", "turn", "open_mouth")

_consumed_tokens: set[str] = set()
_last_actions: tuple[str, ...] | None = None


def _prune_consumed_tokens(max_size: int = 10_000) -> None:
    if len(_consumed_tokens) > max_size:
        _consumed_tokens.clear()


def create_liveness_challenge(
    secret: str, ttl_seconds: int, num_actions: int = 3
) -> tuple[str, list[str]]:
    """A challenge with `num_actions` random gestures (2 = quick, 3 = enroll).

    The subset and order are randomized every time: a fixed recorded sequence
    does not work even if the possible gestures are public knowledge.
    """
    global _last_actions
    if num_actions not in (2, 3):
        raise ValueError("num_actions must be 2 or 3")
    randomizer = _secrets.SystemRandom()
    actions = randomizer.sample(list(LIVENESS_ACTIONS), num_actions)
    randomizer.shuffle(actions)
    if tuple(actions) == _last_actions:
        randomizer.shuffle(actions)  # avoid repeating the exact previous sequence
    _last_actions = tuple(actions)
    return _create_token(secret, ttl_seconds, actions, 0), actions


def verify_liveness_challenge(
    secret: str, token: str, require_complete: bool = False
) -> tuple[list[str], int]:
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
            and len(actions) in (2, 3)
            and len(set(actions)) == len(actions)
            and set(actions) <= set(LIVENESS_ACTIONS)
        )
        if payload["exp"] < time.time() or not valid or step not in range(len(actions) + 1):
            raise ValueError("Liveness challenge expired or invalid")
        if require_complete and step != len(actions):
            raise ValueError("Liveness challenge not completed")
        return actions, step
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
    return _create_token(secret, ttl_seconds, actions, next_step), actions, next_step


def consume_liveness_challenge(secret: str, token: str) -> list[str]:
    if token in _consumed_tokens:
        raise ValueError("Liveness challenge already used")
    actions, _ = verify_liveness_challenge(secret, token, require_complete=True)
    _consumed_tokens.add(token)
    _prune_consumed_tokens()
    return actions


def _create_token(secret: str, ttl_seconds: int, actions: list[str], step: int) -> str:
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
