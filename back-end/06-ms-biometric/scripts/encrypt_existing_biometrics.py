"""Encrypt the biometric templates stored before encryption at rest existed (Ley 1581).

Idempotent: only documents whose ``encoding`` is still a plain list, or whose
``raw_sample_b64`` has no ``enc:v1:`` prefix, are rewritten. Run it once after
deploying, inside the service container (it uses the same settings and key):

    docker exec faceattend-ms-biometric python scripts/encrypt_existing_biometrics.py

Pass ``--dry-run`` to only count what would change.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient  # noqa: E402

from domain.value_objects.biometric_type import BiometricType  # noqa: E402
from infrastructure.config.settings import get_settings  # noqa: E402
from infrastructure.persistence.document_mappers import document_to_embedding, embedding_to_document  # noqa: E402
from infrastructure.security.biometric_cipher import PREFIX, get_cipher  # noqa: E402

PLAIN = {
    "$or": [
        {"encoding": {"$type": "array", "$ne": []}},
        {"raw_sample_b64": {"$exists": True, "$type": "string", "$not": {"$regex": f"^{PREFIX}"}}},
    ]
}


def main(dry_run: bool) -> int:
    settings = get_settings()
    get_cipher()  # fail before touching anything if the key is missing
    db = MongoClient(settings.mongodb_url)[settings.mongo_db_name]
    total = 0
    for collection, biometric_type in (
        (settings.facial_collection, BiometricType.FACIAL),
        (settings.fingerprint_collection, BiometricType.FINGERPRINT),
    ):
        pending = db[collection].count_documents(PLAIN)
        print(f"{collection}: {pending} document(s) to encrypt")
        if dry_run:
            continue
        for document in db[collection].find(PLAIN):
            encrypted = embedding_to_document(document_to_embedding(document, biometric_type))
            update = {"encoding": encrypted["encoding"]}
            if "raw_sample_b64" in encrypted:
                update["raw_sample_b64"] = encrypted["raw_sample_b64"]
            db[collection].update_one({"_id": document["_id"]}, {"$set": update})
            total += 1
    print(f"encrypted {total} document(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main("--dry-run" in sys.argv))
