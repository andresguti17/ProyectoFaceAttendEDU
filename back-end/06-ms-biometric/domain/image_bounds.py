"""Bounded image decoding shared by the face and fingerprint paths.

A small compressed file can declare huge dimensions and expand to gigabytes
once OpenCV decodes it, so the size cap alone does not bound memory: the
dimensions are read from the header first and the pixels are decoded only
when they are within the cap.
"""
from __future__ import annotations

import io

import cv2
import numpy as np
from PIL import Image


def max_base64_length(max_bytes: int) -> int:
    """Longest base64 text that can decode to at most `max_bytes` bytes."""
    return 4 * ((max_bytes + 2) // 3)


def decode_bounded(image_bytes: bytes, max_bytes: int, max_pixels: int, flags: int) -> np.ndarray:
    """Decode `image_bytes` with OpenCV `flags`; `ValueError` when it is too big or unreadable."""
    if len(image_bytes) > max_bytes:
        raise ValueError("Image exceeds the maximum allowed size")
    try:
        with Image.open(io.BytesIO(image_bytes)) as header:
            width, height = header.size
    except Exception as exc:
        raise ValueError("Could not decode the image") from exc
    if width * height > max_pixels:
        raise ValueError("Image has too many pixels")
    image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), flags)
    if image is None:
        raise ValueError("Could not decode the image")
    return image
