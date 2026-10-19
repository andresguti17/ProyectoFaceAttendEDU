"""Fingerprint sample decoding — ported from `10-ms-face-auth`'s
`OpenCVBiometricService.decode_fingerprint`.

Tolerates the odd input shapes the mobile fingerprint-reader SDK sends:
URL-encoded payloads, base64url alphabet, chunked JSON-array-of-strings
payloads (reassembled before decoding), and an optional `data:...;base64,`
prefix. Enforces the same size/pixel caps as the image path to bound memory use
and OpenCV processing cost.
"""
from __future__ import annotations

import base64
import json
import re
from urllib.parse import unquote

import cv2
import numpy as np

_BASE64_RE = re.compile(r"[A-Za-z0-9+/]*={0,2}")
_MAX_ENCODED_LENGTH = 4_000_000


def decode_fingerprint(data_base64: str, max_bytes: int, max_pixels: int) -> np.ndarray:
    """Decode a fingerprint sample into a grayscale OpenCV image.

    Raises `ValueError` (never a lower-level exception) on any malformed,
    oversized, or undecodable input, without echoing the raw payload.
    """
    try:
        encoded = unquote(data_base64).strip()
        if encoded.startswith("["):
            decoder = json.JSONDecoder()
            chunks: list[str] = []
            position = 0
            while position < len(encoded):
                while position < len(encoded) and encoded[position].isspace():
                    position += 1
                if position >= len(encoded):
                    break
                value, position = decoder.raw_decode(encoded, position)
                if not isinstance(value, list) or not all(
                    isinstance(chunk, str) for chunk in value
                ):
                    raise ValueError("Invalid sample format")
                chunks.extend(value)
            encoded = "".join(chunks)
        if "," in encoded:
            encoded = encoded.split(",", 1)[1]
        encoded = "".join(encoded.split()).replace("-", "+").replace("_", "/")
        if len(encoded) > _MAX_ENCODED_LENGTH or not _BASE64_RE.fullmatch(encoded):
            raise ValueError("Invalid base64 payload")
        encoded += "=" * (-len(encoded) % 4)
        image_bytes = base64.b64decode(encoded, validate=True)
        if len(image_bytes) > max_bytes:
            raise ValueError("Sample exceeds the maximum allowed size")
        image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
        if image is None:
            raise ValueError("Could not decode the sample")
        if image.shape[0] * image.shape[1] > max_pixels:
            raise ValueError("Sample has too many pixels")
        return image
    except Exception as exc:
        raise ValueError(f"Invalid fingerprint sample: {exc}") from exc
