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


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)
