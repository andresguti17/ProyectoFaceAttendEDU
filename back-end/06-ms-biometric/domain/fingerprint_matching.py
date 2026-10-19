"""Fingerprint keypoint matching — ported from `10-ms-face-auth`'s
`OpenCVBiometricService.fingerprint_score`.

Deliberately NOT cosine similarity: a raw fingerprint sample has no fixed-length
vector representation, so matching is done by counting Lowe-ratio-filtered
keypoint matches between two samples (SIFT, falling back to ORB when SIFT is
unavailable in the OpenCV build). The result is an integer count, compared
against `Settings.fingerprint_match_threshold` — never against
`similarity_threshold` (cosine, facial-only).

Behavior kept identical to the source service on purpose: this algorithm is
already in production use there.
"""
from __future__ import annotations

import numpy as np
import cv2


def fingerprint_keypoint_score(query_image: np.ndarray, stored_image: np.ndarray) -> int:
    """Count of Lowe-ratio-filtered good keypoint matches between two samples."""
    try:
        detector = cv2.SIFT_create()
        matcher = cv2.BFMatcher(cv2.NORM_L2)
        is_orb = False
    except Exception:
        try:
            detector = cv2.xfeatures2d.SIFT_create()
            matcher = cv2.BFMatcher(cv2.NORM_L2)
            is_orb = False
        except Exception:
            detector = cv2.ORB_create()
            matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
            is_orb = True

    _, query_descriptors = detector.detectAndCompute(query_image, None)
    _, stored_descriptors = detector.detectAndCompute(stored_image, None)
    if query_descriptors is None or stored_descriptors is None:
        return 0

    matches = matcher.knnMatch(query_descriptors, stored_descriptors, k=2)
    ratio = 0.75 if is_orb else 0.7
    return sum(
        1 for pair in matches if len(pair) == 2 and pair[0].distance < ratio * pair[1].distance
    )
