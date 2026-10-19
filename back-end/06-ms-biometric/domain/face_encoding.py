"""Face image decoding, encoding and liveness-gesture measurement — ported from
`10-ms-face-auth`'s `OpenCVBiometricService`.

This is what finally gives the biometric service real embedding computation:
until this merge, every facial endpoint required the caller to already have a
128-d `face_recognition` encoding. `face_encoding()` below produces that same
128-d vector from a raw image, so its output is written straight into the
existing `FacialEmbedding.encoding` / compared with the existing
`domain.similarity.cosine` — no new storage model for the facial path.
"""
from __future__ import annotations

import base64

import cv2
import face_recognition
import numpy as np

FACE_DETECTION_MODEL = "hog"
BLINK_EAR_DELTA = 0.06
MOVEMENT_DELTA = 0.05
MOUTH_OPENING_DELTA = 0.07
FRAMES_PER_ACTION = 6


def decode_image(data_url_or_b64: str, max_bytes: int, max_pixels: int) -> np.ndarray:
    """Decode a base64 (optionally `data:...;base64,`-prefixed) image to RGB."""
    try:
        encoded = data_url_or_b64.split(",", 1)[1] if "," in data_url_or_b64 else data_url_or_b64
        image_bytes = base64.b64decode(encoded, validate=True)
        if len(image_bytes) > max_bytes:
            raise ValueError("Image exceeds the maximum allowed size")
        image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Could not decode the image")
        if image.shape[0] * image.shape[1] > max_pixels:
            raise ValueError("Image has too many pixels")
        return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    except Exception as exc:
        raise ValueError(f"Invalid image: {exc}") from exc


def face_encoding(image: np.ndarray) -> list[float] | None:
    """128-d `face_recognition` encoding, or `None` if no face was found.

    Raises `ValueError` if more than one face is present — enrollment and
    identification both require a single, unambiguous subject per frame.
    """
    locations = face_recognition.face_locations(
        image, number_of_times_to_upsample=0, model=FACE_DETECTION_MODEL
    )
    if len(locations) > 1:
        raise ValueError("The image must contain exactly one face")
    encodings = face_recognition.face_encodings(image, locations)
    return list(encodings[0]) if encodings else None


def face_measurements(image: np.ndarray) -> tuple[float, float, float] | None:
    """(eye-aspect-ratio sum, nose horizontal offset, mouth opening ratio)."""
    locations = face_recognition.face_locations(
        image, number_of_times_to_upsample=0, model=FACE_DETECTION_MODEL
    )
    if len(locations) != 1:
        return None
    landmarks = face_recognition.face_landmarks(image, locations)
    if len(landmarks) != 1:
        return None
    left_eye = landmarks[0].get("left_eye")
    right_eye = landmarks[0].get("right_eye")
    nose = landmarks[0].get("nose_tip")
    top_lip = landmarks[0].get("top_lip")
    bottom_lip = landmarks[0].get("bottom_lip")
    if not left_eye or not right_eye or not nose or not top_lip or not bottom_lip:
        return None
    eye_width = np.linalg.norm(np.asarray(left_eye[0]) - np.asarray(right_eye[3]))
    if eye_width == 0:
        return None
    eye_center_x = (left_eye[0][0] + right_eye[3][0]) / 2
    nose_x = float(np.mean(np.asarray(nose)[:, 0]))
    mouth_width = np.linalg.norm(np.asarray(top_lip[0]) - np.asarray(top_lip[6]))
    mouth_height = np.linalg.norm(np.asarray(top_lip[3]) - np.asarray(bottom_lip[3]))
    return (
        _eye_aspect_ratio(left_eye) + _eye_aspect_ratio(right_eye),
        (nose_x - eye_center_x) / eye_width,
        mouth_height / mouth_width if mouth_width else 0.0,
    )


def _eye_aspect_ratio(eye: list[tuple[int, int]]) -> float:
    points = np.asarray(eye, dtype=np.float64)
    horizontal = np.linalg.norm(points[0] - points[3])
    if horizontal == 0:
        return 0.0
    return float(
        (np.linalg.norm(points[1] - points[5]) + np.linalg.norm(points[2] - points[4]))
        / (2 * horizontal)
    )


def _action_detected(action: str, measurements: list[tuple[float, float, float]]) -> bool:
    if action == "blink":
        values = [measurement[0] for measurement in measurements]
        return max(values) - min(values) >= BLINK_EAR_DELTA
    if action == "turn":
        values = [measurement[1] for measurement in measurements]
        return max(values) - min(values) >= MOVEMENT_DELTA
    if action == "open_mouth":
        values = [measurement[2] for measurement in measurements]
        return max(values) - min(values) >= MOUTH_OPENING_DELTA
    return False


def validate_liveness(images: list[np.ndarray], action: str) -> bool:
    """One action's worth of frames (`FRAMES_PER_ACTION`) show the gesture."""
    if len(images) != FRAMES_PER_ACTION:
        return False
    measurements: list[tuple[float, float, float]] = []
    for image in images:
        measurement = face_measurements(image)
        if measurement is None:
            return False
        measurements.append(measurement)
    return _action_detected(action, measurements)
