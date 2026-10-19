"""In-memory test doubles for the driven ports.

These replace the deleted production `MemoryStore`: they exist only so tests can
exercise routers and use-case logic without a database. They mirror the MongoDB
adapter's semantics — one active template per scope, supersede on enroll, soft
delete, reads that never return tombstones — so a test that passes here is
testing the same contract the Mongo adapter implements.
"""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone

from domain.entities.biometric_template import BiometricTemplate
from domain.entities.match_log import BiometricMatchLog
from domain.entities.update_case import BiometricUpdateCase
from domain.ports.out.biometric_repository import BiometricRepositoryPort
from domain.ports.out.match_log_repository import MatchLogRepositoryPort
from domain.ports.out.update_case_repository import UpdateCaseRepositoryPort
from domain.value_objects.biometric_type import BiometricType
from domain.value_objects.update_case_status import UpdateCaseStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InMemoryBiometricRepository(BiometricRepositoryPort):
    def __init__(self, biometric_type: BiometricType = BiometricType.FACIAL) -> None:
        self._type = biometric_type
        self._documents: dict[str, BiometricTemplate] = {}

    # -- helpers --------------------------------------------------------
    def _scope_of(self, template: BiometricTemplate) -> tuple[str, int | None]:
        return (template.person_id, getattr(template, "finger_number", None))

    def _matches(
        self, template: BiometricTemplate, person_id: str | None, finger_number: int | None
    ) -> bool:
        if person_id is not None and template.person_id != person_id:
            return False
        if finger_number is not None and getattr(template, "finger_number", None) != finger_number:
            return False
        return True

    def _alive(self, template: BiometricTemplate) -> bool:
        return template.deleted_at is None

    # -- port -----------------------------------------------------------
    async def enroll(self, template: BiometricTemplate) -> BiometricTemplate:
        scope = self._scope_of(template)
        now = _utcnow()
        version = sum(1 for stored in self._documents.values() if self._scope_of(stored) == scope) + 1

        for key, stored in self._documents.items():
            if self._scope_of(stored) == scope and stored.is_active and self._alive(stored):
                self._documents[key] = replace(stored, is_active=False, updated_at=now)

        persisted = replace(
            template,
            template_version=version,
            is_active=True,
            enrolled_at=template.enrolled_at or now,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        self._documents[persisted.embedding_id] = persisted
        return persisted

    async def find_active(
        self, person_id: str, finger_number: int | None = None
    ) -> BiometricTemplate | None:
        candidates = [
            template
            for template in self._documents.values()
            if template.is_active
            and self._alive(template)
            and self._matches(template, person_id, finger_number)
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda template: template.template_version)

    async def list_active(
        self, person_id: str | None = None, finger_number: int | None = None
    ) -> list[BiometricTemplate]:
        selected = [
            template
            for template in self._documents.values()
            if template.is_active
            and self._alive(template)
            and self._matches(template, person_id, finger_number)
        ]
        return sorted(
            selected, key=lambda template: (template.person_id, -template.template_version)
        )

    async def list_history(self, person_id: str) -> list[BiometricTemplate]:
        selected = [
            template
            for template in self._documents.values()
            if template.person_id == person_id and self._alive(template)
        ]
        return sorted(selected, key=lambda template: template.template_version)

    async def deactivate(self, person_id: str, finger_number: int | None = None) -> int:
        if not person_id:
            raise ValueError("person_id is required to deactivate templates")
        now = _utcnow()
        count = 0
        for key, template in self._documents.items():
            if (
                template.is_active
                and self._alive(template)
                and self._matches(template, person_id, finger_number)
            ):
                self._documents[key] = replace(
                    template, is_active=False, deleted_at=now, updated_at=now
                )
                count += 1
        return count

    # -- test introspection ---------------------------------------------
    def stored(self) -> list[BiometricTemplate]:
        """Everything held, including superseded and soft-deleted documents."""
        return list(self._documents.values())


class InMemoryUpdateCaseRepository(UpdateCaseRepositoryPort):
    def __init__(self) -> None:
        self._cases: dict[str, BiometricUpdateCase] = {}

    async def create(self, case: BiometricUpdateCase) -> BiometricUpdateCase:
        now = _utcnow()
        persisted = replace(case, is_active=True, created_at=now, updated_at=now, deleted_at=None)
        self._cases[persisted.request_id] = persisted
        return persisted

    async def find_by_request_id(self, request_id: str) -> BiometricUpdateCase | None:
        case = self._cases.get(request_id)
        if case is None or not case.is_active or case.deleted_at is not None:
            return None
        return case

    async def list_for_person(self, person_id: str) -> list[BiometricUpdateCase]:
        selected = [
            case
            for case in self._cases.values()
            if case.person_id == person_id and case.is_active and case.deleted_at is None
        ]
        return sorted(
            selected,
            key=lambda case: case.requested_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

    async def review(
        self, request_id: str, status: UpdateCaseStatus
    ) -> BiometricUpdateCase | None:
        current = await self.find_by_request_id(request_id)
        if current is None:
            return None
        reviewed = current.review(status, _utcnow())
        self._cases[request_id] = reviewed
        return reviewed

    async def deactivate(self, request_id: str) -> bool:
        current = await self.find_by_request_id(request_id)
        if current is None:
            return False
        now = _utcnow()
        self._cases[request_id] = replace(
            current, is_active=False, deleted_at=now, updated_at=now
        )
        return True

    def stored(self) -> list[BiometricUpdateCase]:
        return list(self._cases.values())


class InMemoryMatchLogRepository(MatchLogRepositoryPort):
    def __init__(self) -> None:
        self.entries: list[BiometricMatchLog] = []

    async def record(self, entry: BiometricMatchLog) -> None:
        self.entries.append(entry)
