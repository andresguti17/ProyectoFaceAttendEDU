"""liveness_report: why a gesture was refused, and tolerance for frames without a face."""
from __future__ import annotations

import numpy as np
import pytest

import domain.face_encoding as fe
from domain.face_encoding import FaceMeasurements, liveness_report

FRAMES = [np.full((8, 8, 3), i * 9, dtype=np.uint8) for i in range(fe.FRAMES_PER_ACTION)]  # not frozen


def _measure(monkeypatch, series):
    """`series`: one FaceMeasurements (or None for a frame with no face) per frame."""
    iterator = iter(series)
    monkeypatch.setattr(fe, "face_measurements", lambda image: next(iterator))


def _m(yaw=0.0, mouth_open=0.1):
    return FaceMeasurements(ear=0.6, yaw=yaw, mouth_open=mouth_open, mouth_width=0.4, pitch=0.5)


def test_a_turn_loses_the_face_in_the_last_frames_but_is_still_detected(monkeypatch):
    # The detector drops the profile view: 4 measured frames are enough.
    _measure(monkeypatch, [_m(0.00), _m(0.03), _m(0.08), _m(0.12), None, None])
    report = liveness_report(FRAMES, "turn_left")
    assert report.detected and report.reason == "ok"


def test_too_few_measured_frames_is_refused_with_the_count(monkeypatch):
    _measure(monkeypatch, [_m(0.0), _m(0.2), None, None, None, None])
    report = liveness_report(FRAMES, "turn_left")
    assert not report.detected
    assert report.reason == "face measured in 2/6 frames"


def test_a_small_movement_reports_the_numbers(monkeypatch):
    _measure(monkeypatch, [_m(0.00), _m(0.01), _m(0.02), _m(0.01), _m(0.02), _m(0.01)])
    report = liveness_report(FRAMES, "turn_left")
    assert not report.detected
    assert report.reason.startswith("turn_left movement 0.020 < 0.050")


def test_a_wrong_frame_count_and_a_still_image_are_refused():
    assert liveness_report(FRAMES[:3], "blink").reason.startswith("expected 6 frames")
    still = [FRAMES[0]] * fe.FRAMES_PER_ACTION
    assert liveness_report(still, "blink").reason == (
        f"frames are identical (still image, max difference 0.00 < {fe.FROZEN_FRAME_DIFF})"
    )


@pytest.mark.parametrize("action", ["blink", "turn", "turn_left", "turn_right", "open_mouth", "smile", "nod"])
def test_validate_liveness_is_the_boolean_view_of_the_report(monkeypatch, action):
    _measure(monkeypatch, [_m()] * fe.FRAMES_PER_ACTION)
    assert fe.validate_liveness(FRAMES, action) is False
