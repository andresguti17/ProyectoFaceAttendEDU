"""Secondary (driven) port: biometric template persistence.

One contract serves both modalities; the adapter is constructed with the
`BiometricType` it stores, which selects the collection and decides whether
`finger_number` participates in the identity of a template.

Life-cycle rules enforced by every implementation (ADR-003 /
fae-docs/06-data/domains/06-biometric.md):

* **Soft delete only** — nothing is ever removed from the store. `deactivate`
  clears `is_active` and stamps `deleted_at`.
* **Reads never return soft-deleted documents.**
* **At most one active template per scope** (person for facial, person + finger
  for fingerprint). Enrolling supersedes the previous active version instead of
  overwriting it, so the full version history survives.
* **Failures propagate.** Implementations must not fall back to an in-process
  store or swallow driver errors; an unreachable database is an error the caller
  has to see.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from domain.entities.biometric_template import BiometricTemplate


class BiometricRepositoryPort(ABC):
    @abstractmethod
    async def enroll(self, template: BiometricTemplate) -> BiometricTemplate:
        """Persist `template` as the new active version and supersede the previous one.

        Returns the persisted entity, with `template_version`, `created_at` and
        `updated_at` assigned by the store.
        """

    @abstractmethod
    async def find_active(
        self, person_id: str, finger_number: int | None = None
    ) -> BiometricTemplate | None:
        """Highest-version active template for the scope, or None."""

    @abstractmethod
    async def list_active(
        self, person_id: str | None = None, finger_number: int | None = None
    ) -> list[BiometricTemplate]:
        """Active templates for a scope.

        `person_id=None` returns every active template in the collection and is
        the 1:N identify scan; implementations bound it with a configured limit
        and report loudly when the limit is hit.
        """

    @abstractmethod
    async def list_history(self, person_id: str) -> list[BiometricTemplate]:
        """All non-deleted versions for a person, oldest version first.

        Includes superseded (inactive) templates — that is the point of a
        history — but excludes soft-deleted ones.
        """

    @abstractmethod
    async def deactivate(self, person_id: str, finger_number: int | None = None) -> int:
        """Soft-delete the active templates of a scope. Returns how many were deactivated."""
