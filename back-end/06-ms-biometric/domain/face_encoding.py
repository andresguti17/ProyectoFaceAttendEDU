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
from typing import NamedTuple

import cv2
import face_recognition
import numpy as np

FACE_DETECTION_MODEL = "hog"
BLINK_EAR_DELTA = 0.06
MOVEMENT_DELTA = 0.05
MOUTH_OPENING_DELTA = 0.07
SMILE_DELTA = 0.03
NOD_DELTA = 0.08
# Mean absolute pixel difference (0-255) under which two consecutive frames are
# considered the same still image.
FROZEN_FRAME_DIFF = 0.5
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


class FaceMeasurements(NamedTuple):
    """Scale-free geometry of one frame: relative to the eye distance (or the
    jaw width for `mouth_width`), so it does not depend on camera distance."""

    ear: float  # eye-aspect-ratio sum of both eyes (blink)
    yaw: float  # nose offset from the eye centre; grows when turning to the person's left
    mouth_open: float  # lip gap / mouth width
    mouth_width: float  # mouth width / jaw width (smile)
    pitch: float  # nose height below the eye line (nod)


def face_measurements(image: np.ndarray) -> FaceMeasurements | None:
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
    chin = landmarks[0].get("chin")
    if not left_eye or not right_eye or not nose or not top_lip or not bottom_lip or not chin:
        return None
    eye_width = np.linalg.norm(np.asarray(left_eye[0]) - np.asarray(right_eye[3]))
    jaw_width = np.linalg.norm(np.asarray(chin[0]) - np.asarray(chin[-1]))
    if eye_width == 0 or jaw_width == 0:
        return None
    eye_center_x = (left_eye[0][0] + right_eye[3][0]) / 2
    eye_center_y = (left_eye[0][1] + right_eye[3][1]) / 2
    nose_points = np.asarray(nose)
    mouth_width = np.linalg.norm(np.asarray(top_lip[0]) - np.asarray(top_lip[6]))
    mouth_height = np.linalg.norm(np.asarray(top_lip[3]) - np.asarray(bottom_lip[3]))
    return FaceMeasurements(
        ear=_eye_aspect_ratio(left_eye) + _eye_aspect_ratio(right_eye),
        yaw=(float(np.mean(nose_points[:, 0])) - eye_center_x) / eye_width,
        mouth_open=float(mouth_height / mouth_width) if mouth_width else 0.0,
        mouth_width=float(mouth_width / jaw_width),
        pitch=(float(np.mean(nose_points[:, 1])) - eye_center_y) / eye_width,
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


def _action_detected(action: str, measurements: list[FaceMeasurements]) -> bool:
    def series(field: str) -> list[float]:
        return [getattr(measurement, field) for measurement in measurements]

    if action == "blink":
        values = series("ear")
        return max(values) - min(values) >= BLINK_EAR_DELTA
    if action == "turn":  # legacy: any horizontal movement, no direction
        values = series("yaw")
        return max(values) - min(values) >= MOVEMENT_DELTA
    if action == "turn_left":
        values = series("yaw")
        return max(values) - values[0] >= MOVEMENT_DELTA
    if action == "turn_right":
        values = series("yaw")
        return values[0] - min(values) >= MOVEMENT_DELTA
    if action == "open_mouth":
        values = series("mouth_open")
        return max(values) - min(values) >= MOUTH_OPENING_DELTA
    if action == "smile":
        values = series("mouth_width")
        return max(values) - values[0] >= SMILE_DELTA
    if action == "nod":
        values = series("pitch")
        return max(values) - min(values) >= NOD_DELTA
    return False


def _frames_are_frozen(images: list[np.ndarray]) -> bool:
    """True when every consecutive pair of frames is (almost) pixel-identical:
    a still image or a repeated frame, never a live camera (sensor noise alone
    moves pixels)."""
    for previous, current in zip(images, images[1:]):
        if previous.shape != current.shape:
            return False
        diff = np.mean(np.abs(previous.astype(np.int16) - current.astype(np.int16)))
        if float(diff) >= FROZEN_FRAME_DIFF:
            return False
    return True


def validate_liveness(images: list[np.ndarray], action: str) -> bool:
    """One action's worth of frames (`FRAMES_PER_ACTION`) show the gesture."""
    if len(images) != FRAMES_PER_ACTION:
        return False
    if _frames_are_frozen(images):
        return False
    measurements: list[FaceMeasurements] = []
    for image in images:
        measurement = face_measurements(image)
        if measurement is None:
            return False
        measurements.append(measurement)
    return _action_detected(action, measurements)
