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

from domain.image_bounds import decode_bounded, max_base64_length

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
# Frames of a gesture in which the face must be measured (see `liveness_report`).
MIN_MEASURED_FRAMES = 4


def decode_image(data_url_or_b64: str, max_bytes: int, max_pixels: int) -> np.ndarray:
    """Decode a base64 (optionally `data:...;base64,`-prefixed) image to RGB."""
    try:
        encoded = data_url_or_b64.split(",", 1)[1] if "," in data_url_or_b64 else data_url_or_b64
        # Reject oversized text before decoding it, not after.
        if len(encoded) > max_base64_length(max_bytes):
            raise ValueError("Image exceeds the maximum allowed size")
        image_bytes = base64.b64decode(encoded, validate=True)
        image = decode_bounded(image_bytes, max_bytes, max_pixels, cv2.IMREAD_COLOR)
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


def _gesture_delta(action: str, measurements: list[FaceMeasurements]) -> tuple[float, float] | None:
    """(observed movement, movement needed) for `action`; None for an unknown action."""

    def series(field: str) -> list[float]:
        return [getattr(measurement, field) for measurement in measurements]

    if action == "blink":
        values = series("ear")
        return max(values) - min(values), BLINK_EAR_DELTA
    if action == "turn":  # legacy: any horizontal movement, no direction
        values = series("yaw")
        return max(values) - min(values), MOVEMENT_DELTA
    if action == "turn_left":
        values = series("yaw")
        return max(values) - values[0], MOVEMENT_DELTA
    if action == "turn_right":
        values = series("yaw")
        return values[0] - min(values), MOVEMENT_DELTA
    if action == "open_mouth":
        values = series("mouth_open")
        return max(values) - min(values), MOUTH_OPENING_DELTA
    if action == "smile":
        values = series("mouth_width")
        return max(values) - values[0], SMILE_DELTA
    if action == "nod":
        values = series("pitch")
        return max(values) - min(values), NOD_DELTA
    return None


def _action_detected(action: str, measurements: list[FaceMeasurements]) -> bool:
    gesture = _gesture_delta(action, measurements)
    return gesture is not None and gesture[0] >= gesture[1]


def _max_frame_diff(images: list[np.ndarray]) -> float:
    """Largest mean absolute pixel difference (0-255) between consecutive frames."""
    largest = 0.0
    for previous, current in zip(images, images[1:]):
        if previous.shape != current.shape:
            return float("inf")
        diff = np.mean(np.abs(previous.astype(np.int16) - current.astype(np.int16)))
        largest = max(largest, float(diff))
    return largest


def _frames_are_frozen(images: list[np.ndarray]) -> bool:
    """True when every consecutive pair of frames is (almost) pixel-identical:
    a still image or a repeated frame, never a live camera (sensor noise alone
    moves pixels)."""
    return _max_frame_diff(images) < FROZEN_FRAME_DIFF


class LivenessReport(NamedTuple):
    detected: bool
    reason: str  # why it failed (or "ok"); numbers only, never image or face data


def liveness_report(images: list[np.ndarray], action: str) -> LivenessReport:
    """One action's worth of frames (`FRAMES_PER_ACTION`) and whether they show the gesture.

    Frames where no single face with landmarks is found (a head turned far, a nod,
    motion blur) are skipped instead of failing the whole gesture, but at least
    `MIN_MEASURED_FRAMES` must be measured — the detector loses the face first
    precisely when the person does the movement being asked for.
    """
    if len(images) != FRAMES_PER_ACTION:
        return LivenessReport(False, f"expected {FRAMES_PER_ACTION} frames, got {len(images)}")
    if _frames_are_frozen(images):
        return LivenessReport(
            False,
            f"frames are identical (still image, max difference {_max_frame_diff(images):.2f} < {FROZEN_FRAME_DIFF})",
        )
    measurements: list[FaceMeasurements] = []
    for image in images:
        measurement = face_measurements(image)
        if measurement is not None:
            measurements.append(measurement)
    if len(measurements) < MIN_MEASURED_FRAMES:
        return LivenessReport(False, f"face measured in {len(measurements)}/{len(images)} frames")
    gesture = _gesture_delta(action, measurements)
    if gesture is None:
        return LivenessReport(False, f"unknown gesture {action}")
    observed, needed = gesture
    if observed < needed:
        return LivenessReport(
            False, f"{action} movement {observed:.3f} < {needed:.3f} ({len(measurements)}/{len(images)} frames)"
        )
    return LivenessReport(True, "ok")


def validate_liveness(images: list[np.ndarray], action: str) -> bool:
    return liveness_report(images, action).detected
