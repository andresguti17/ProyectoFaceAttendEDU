"""Writes docs/openapi/06-ms-biometric.json from the FastAPI app.

Run from back-end/06-ms-biometric with its dependencies installed:
    poetry run python ../../tools/openapi/biometric.py
Importing main does not connect to MongoDB (that happens on startup).
"""
import json
import os
import sys

sys.path.insert(0, os.getcwd())
import main  # noqa: E402

spec = main.app.openapi()
spec.pop("servers", None)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "openapi", "06-ms-biometric.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8", newline="\n") as f:
    json.dump(spec, f, indent=2, sort_keys=True, ensure_ascii=False)
    f.write("\n")
print("wrote docs/openapi/06-ms-biometric.json")
