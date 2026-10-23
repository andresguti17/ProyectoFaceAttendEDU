"""The school's 'confidence' (50-100 %) becomes the face match threshold, never an unsafe one."""
from __future__ import annotations

import asyncio

import pytest

from domain.similarity import face_threshold_from_confidence
from infrastructure.web import security


def test_confidence_maps_linearly_between_dlib_tolerance_and_the_strictest_distance():
    assert face_threshold_from_confidence(50) == pytest.approx(0.40)  # distance 0.60
    assert face_threshold_from_confidence(100) == pytest.approx(0.65)  # distance 0.35
    assert face_threshold_from_confidence(90) == pytest.approx(0.60)  # distance 0.40


def test_out_of_range_confidence_is_clamped():
    assert face_threshold_from_confidence(0) == pytest.approx(0.40)
    assert face_threshold_from_confidence(1000) == pytest.approx(0.65)


@pytest.fixture(autouse=True)
def _fresh_cache():
    security._school_confidence_cache.clear()
    yield
    security._school_confidence_cache.clear()


def _run(coro):
    return asyncio.run(coro)


def test_caller_without_a_school_keeps_the_default(monkeypatch):
    async def no_school(user_id, token):
        return (False, None)

    monkeypatch.setattr(security, "resolve_caller_school", no_school)
    assert _run(security.face_threshold_for_caller("u", "t", 0.5)) == 0.5


def test_super_admin_keeps_the_default(monkeypatch):
    async def super_admin(user_id, token):
        return (True, None)

    monkeypatch.setattr(security, "resolve_caller_school", super_admin)
    assert _run(security.face_threshold_for_caller("u", "t", 0.5)) == 0.5


def test_school_confidence_replaces_the_default(monkeypatch):
    async def school(user_id, token):
        return (False, "28")

    async def rows(url, token):
        assert url.endswith("/api/v1/schools/28/configurations")
        return [{"configurationName": "web.facial_confidence", "configurationValue": "90"}]

    monkeypatch.setattr(security, "resolve_caller_school", school)
    monkeypatch.setattr(security, "_get_list", rows)
    assert _run(security.face_threshold_for_caller("u", "t", 0.5)) == pytest.approx(0.60)


def test_missing_or_broken_setting_keeps_the_default(monkeypatch):
    async def school(user_id, token):
        return (False, "28")

    async def junk(url, token):
        return [{"configurationName": "web.facial_confidence", "configurationValue": "alto"}]

    monkeypatch.setattr(security, "resolve_caller_school", school)
    monkeypatch.setattr(security, "_get_list", junk)
    assert _run(security.face_threshold_for_caller("u", "t", 0.5)) == 0.5
