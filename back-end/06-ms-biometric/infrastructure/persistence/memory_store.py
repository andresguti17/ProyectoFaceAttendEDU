"""In-memory embedding stores (MongoDB parity via Motor when configured).

Runtime uses memory so basic CRUD works without MongoDB. Document shape
matches fae-docs/06-data/domains/06-biometric.md.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EmbeddingStore:
    def __init__(self) -> None:
        self._docs: dict[str, dict[str, Any]] = {}

    def enroll(self, doc: dict[str, Any]) -> dict[str, Any]:
        record = {
            "_id": str(uuid4()),
            "is_active": True,
            "enrolled_at": _now(),
            **doc,
        }
        # deactivate previous active templates of same person (+finger)
        for other in self._docs.values():
            if not other["is_active"]:
                continue
            if other["person_id"] != record["person_id"]:
                continue
            if "finger_number" in record or "finger_number" in other:
                if other.get("finger_number") != record.get("finger_number"):
                    continue
            other["is_active"] = False
        self._docs[record["_id"]] = record
        return record

    def active_for(self, person_id: str, finger: int | None = None) -> list[dict[str, Any]]:
        out = []
        for doc in self._docs.values():
            if not doc["is_active"] or doc["person_id"] != person_id:
                continue
            if finger is not None and doc.get("finger_number") != finger:
                continue
            out.append(doc)
        return out

    def history_for(self, person_id: str) -> list[dict[str, Any]]:
        return [d for d in self._docs.values() if d["person_id"] == person_id]

    def delete_active(self, person_id: str, finger: int | None = None) -> bool:
        removed = False
        for doc in self.active_for(person_id, finger):
            doc["is_active"] = False
            removed = True
        return removed


facial_store = EmbeddingStore()
fingerprint_store = EmbeddingStore()
update_requests: dict[str, dict[str, Any]] = {}
