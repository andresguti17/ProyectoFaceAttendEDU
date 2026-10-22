"""Cosine similarity for 1:1 verify and 1:N identify (pure stdlib)."""
import math


def euclidean(a: list[float], b: list[float]) -> float:
    """Distance dlib's 128-d face encodings are trained for (same person < ~0.6)."""
    if not a or not b or len(a) != len(b):
        return math.inf
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def face_similarity(a: list[float], b: list[float]) -> float:
    """Face score in [0, 1], higher is closer: `1 - euclidean distance`."""
    return max(0.0, 1.0 - euclidean(a, b))


def face_threshold_from_confidence(percent: float) -> float:
    """Face score threshold (`1 - max distance`) for the confidence a school sets in Settings.

    The slider runs 50-100 %: 50 % is dlib's own same-person tolerance (distance
    0.60) and 100 % the strictest allowed (0.35). Out-of-range values are clamped,
    so a bad setting can never open the matcher wider than dlib's tolerance or
    close it past what a real camera can meet.
    """
    clamped = min(max(percent, 50.0), 100.0)
    return 1.0 - (0.60 - (clamped - 50.0) * 0.005)


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)
