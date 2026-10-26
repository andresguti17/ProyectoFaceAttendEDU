"""Bounded decoding: oversized payloads and decompression bombs never reach OpenCV."""
from __future__ import annotations

import base64
import io

import cv2
import pytest
from PIL import Image

import domain.image_bounds as image_bounds
from domain.face_encoding import decode_image
from domain.fingerprint_decode import decode_fingerprint
from domain.image_bounds import decode_bounded, max_base64_length


def _png(width: int, height: int) -> bytes:
    buffer = io.BytesIO()
    Image.new("L", (width, height)).save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def test_a_small_file_declaring_huge_dimensions_is_rejected_before_decoding(monkeypatch):
    bomb = _png(5000, 5000)  # a few KB compressed, 25 megapixels once decoded
    assert len(bomb) < 100_000

    def fail_if_called(*_args, **_kwargs):
        raise AssertionError("cv2.imdecode must not run on an over-sized image")

    monkeypatch.setattr(image_bounds.cv2, "imdecode", fail_if_called)
    with pytest.raises(ValueError, match="too many pixels"):
        decode_bounded(bomb, max_bytes=3_000_000, max_pixels=16_000_000, flags=cv2.IMREAD_COLOR)


def test_an_image_within_both_caps_decodes():
    image = decode_bounded(_png(40, 30), 3_000_000, 16_000_000, cv2.IMREAD_GRAYSCALE)
    assert image.shape == (30, 40)


def test_bytes_that_are_not_an_image_are_rejected():
    with pytest.raises(ValueError, match="Could not decode"):
        decode_bounded(b"not an image", 3_000_000, 16_000_000, cv2.IMREAD_COLOR)


def test_oversized_base64_text_is_rejected_before_it_is_decoded(monkeypatch):
    def fail_if_called(*_args, **_kwargs):
        raise AssertionError("b64decode must not run on oversized text")

    monkeypatch.setattr("domain.face_encoding.base64.b64decode", fail_if_called)
    too_long = "A" * (max_base64_length(1000) + 4)
    with pytest.raises(ValueError, match="maximum allowed size"):
        decode_image(too_long, max_bytes=1000, max_pixels=16_000_000)


def test_both_decoders_share_the_pixel_cap():
    payload = base64.b64encode(_png(200, 200)).decode()
    with pytest.raises(ValueError, match="too many pixels"):
        decode_image(payload, max_bytes=3_000_000, max_pixels=100)
    with pytest.raises(ValueError, match="too many pixels"):
        decode_fingerprint(payload, max_bytes=3_000_000, max_pixels=100)
