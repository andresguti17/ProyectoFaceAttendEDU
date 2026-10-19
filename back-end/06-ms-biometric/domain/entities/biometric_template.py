"""Union of the biometric template entities handled by the persistence ports.

Both templates share the same life cycle (enroll -> supersede -> soft delete)
and the same audit fields, so a single secondary port
(`domain.ports.out.biometric_repository.BiometricRepositoryPort`) serves both
collections; the modality is a constructor argument of the adapter, not a
difference in the contract.
"""
from __future__ import annotations

from domain.entities.facial_embedding import FacialEmbedding
from domain.entities.fingerprint_embedding import FingerprintEmbedding

BiometricTemplate = FacialEmbedding | FingerprintEmbedding

__all__ = ["BiometricTemplate", "FacialEmbedding", "FingerprintEmbedding"]
