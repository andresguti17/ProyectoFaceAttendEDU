"""Gesture detection over per-frame measurements (no real images, no dlib calls)."""
from __future__ import annotations

import numpy as np

from domain.face_encoding import FaceMeasurements, _action_detected, _frames_are_frozen


def _frames(**overrides):
    """Six neutral frames; `overrides` maps a field to its six values."""
    base = dict(ear=0.6, yaw=0.0, mouth_open=0.1, mouth_width=0.40, pitch=0.7)
    series = {key: [value] * 6 for key, value in base.items()}
    series.update(overrides)
    return [FaceMeasurements(*(series[field][i] for field in FaceMeasurements._fields)) for i in range(6)]


class TestDirectionalTurn:
    def test_turn_left_needs_the_nose_to_move_toward_the_left_of_the_person(self):
        frames = _frames(yaw=[0.0, 0.02, 0.05, 0.08, 0.10, 0.12])
        assert _action_detected("turn_left", frames)
        assert not _action_detected("turn_right", frames)

    def test_turn_right_needs_the_opposite_movement(self):
        frames = _frames(yaw=[0.0, -0.02, -0.05, -0.08, -0.10, -0.12])
        assert _action_detected("turn_right", frames)
        assert not _action_detected("turn_left", frames)

    def test_legacy_turn_accepts_either_direction(self):
        assert _action_detected("turn", _frames(yaw=[0.0, 0.02, 0.05, 0.08, 0.10, 0.12]))
        assert _action_detected("turn", _frames(yaw=[0.0, -0.02, -0.05, -0.08, -0.10, -0.12]))

    def test_a_still_head_is_not_a_turn(self):
        frames = _frames(yaw=[0.0, 0.01, 0.0, -0.01, 0.0, 0.01])
        assert not any(_action_detected(a, frames) for a in ("turn", "turn_left", "turn_right"))


class TestSmile:
    def test_a_wider_mouth_is_a_smile(self):
        assert _action_detected("smile", _frames(mouth_width=[0.40, 0.41, 0.43, 0.45, 0.46, 0.46]))

    def test_a_neutral_mouth_is_not(self):
        assert not _action_detected("smile", _frames(mouth_width=[0.40, 0.405, 0.40, 0.41, 0.40, 0.405]))

    def test_opening_the_mouth_alone_is_not_a_smile(self):
        frames = _frames(mouth_open=[0.1, 0.2, 0.3, 0.3, 0.2, 0.1])
        assert _action_detected("open_mouth", frames)
        assert not _action_detected("smile", frames)


class TestNod:
    def test_pitch_swing_is_a_nod(self):
        assert _action_detected("nod", _frames(pitch=[0.70, 0.74, 0.80, 0.86, 0.80, 0.72]))

    def test_steady_pitch_is_not(self):
        assert not _action_detected("nod", _frames(pitch=[0.70, 0.71, 0.70, 0.69, 0.70, 0.71]))


def test_unknown_action_is_never_detected():
    assert not _action_detected("wave", _frames(yaw=[0, 1, 2, 3, 4, 5]))


class TestFrozenFrames:
    def test_identical_frames_are_frozen(self):
        image = np.full((8, 8, 3), 100, dtype=np.uint8)
        assert _frames_are_frozen([image.copy() for _ in range(6)])

    def test_sensor_noise_is_not_frozen(self):
        rng = np.random.default_rng(1)
        frames = [rng.integers(90, 110, (8, 8, 3), dtype=np.uint8) for _ in range(6)]
        assert not _frames_are_frozen(frames)
