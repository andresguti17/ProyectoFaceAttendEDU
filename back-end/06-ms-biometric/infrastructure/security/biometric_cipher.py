"""Encryption at rest of biometric data (Ley 1581 de 2012).

Biometric data are sensitive data (art. 5) and the security principle (art. 4-g)
asks for technical measures against unauthorized access. Face encodings and raw
fingerprint samples are therefore stored AES-256-GCM encrypted
(security-rules.md A02), as ``enc:v1:<base64(nonce | ciphertext)>``.

MongoDB here is the community edition, standalone: its automatic client-side
field-level encryption (ADR-016) needs Enterprise or Atlas, so the service
encrypts the two fields itself. The document ``_id`` is used as associated data,
so a ciphertext copied onto another person's document does not decrypt.

Values without the prefix were written before encryption existed; they are read
as is until ``scripts/encrypt_existing_biometrics.py`` rewrites them.
"""
from __future__ import annotations

import base64
import os
import struct
from functools import lru_cache

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PREFIX = "enc:v1:"
_NONCE_BYTES = 12


class BiometricCipher:
    def __init__(self, base64_key: str | None) -> None:
        if not base64_key:
            raise RuntimeError(
                "BIOMETRIC_ENCRYPTION_KEY is required (base64 of 32 random bytes: openssl rand -base64 32)"
            )
        key = base64.b64decode(base64_key.strip())
        if len(key) != 32:
            raise RuntimeError("BIOMETRIC_ENCRYPTION_KEY must decode to 32 bytes")
        self._aead = AESGCM(key)

    @staticmethod
    def is_encrypted(value: object) -> bool:
        return isinstance(value, str) and value.startswith(PREFIX)

    def _seal(self, plaintext: bytes, aad: str) -> str:
        nonce = os.urandom(_NONCE_BYTES)
        sealed = self._aead.encrypt(nonce, plaintext, aad.encode("utf-8"))
        return PREFIX + base64.b64encode(nonce + sealed).decode("ascii")

    def _open(self, stored: str, aad: str) -> bytes:
        raw = base64.b64decode(stored[len(PREFIX):])
        try:
            return self._aead.decrypt(raw[:_NONCE_BYTES], raw[_NONCE_BYTES:], aad.encode("utf-8"))
        except InvalidTag as exc:
            # Wrong key, tampered value or a value moved from another document.
            raise ValueError("Cannot decrypt biometric data") from exc

    def encrypt_floats(self, values: list[float], aad: str) -> str:
        return self._seal(struct.pack(f">{len(values)}d", *values), aad)

    def decrypt_floats(self, stored: str, aad: str) -> list[float]:
        data = self._open(stored, aad)
        return list(struct.unpack(f">{len(data) // 8}d", data))

    def encrypt_text(self, text: str, aad: str) -> str:
        return self._seal(text.encode("utf-8"), aad)

    def decrypt_text(self, stored: str, aad: str) -> str:
        return self._open(stored, aad).decode("utf-8")


@lru_cache
def get_cipher() -> BiometricCipher:
    from infrastructure.config.settings import get_settings

    return BiometricCipher(get_settings().biometric_encryption_key)
