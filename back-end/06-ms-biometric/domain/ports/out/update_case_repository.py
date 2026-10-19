"""Secondary (driven) port: biometric update case persistence.

Soft delete only, same as the template repositories: `deactivate` flags the
case, it never removes the document.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from domain.entities.update_case import BiometricUpdateCase
from domain.value_objects.update_case_status import UpdateCaseStatus


class UpdateCaseRepositoryPort(ABC):
    @abstractmethod
    async def create(self, case: BiometricUpdateCase) -> BiometricUpdateCase:
        """Persist a new case and return it with the store-assigned audit fields."""

    @abstractmethod
    async def find_by_request_id(self, request_id: str) -> BiometricUpdateCase | None:
        """Active case with this public request id, or None (soft-deleted counts as None)."""

    @abstractmethod
    async def list_for_person(self, person_id: str) -> list[BiometricUpdateCase]:
        """Active cases of a person, newest request first."""

    @abstractmethod
    async def review(
        self, request_id: str, status: UpdateCaseStatus
    ) -> BiometricUpdateCase | None:
        """Transition an active case to `status`. Returns None when it does not exist."""

    @abstractmethod
    async def deactivate(self, request_id: str) -> bool:
        """Soft-delete a case. True when a live document was flagged."""
