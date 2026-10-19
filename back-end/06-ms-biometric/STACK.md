# STACK — 06-ms-biometric

> **Stack ADR-005:** `Python 3.12 + FastAPI` · **Guía:** `../../fae-docs/_stacks/python-fastapi.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **ADR:** `../../fae-docs/05-architecture/decisions/records/ADR-005-technology-stack.md`
> **Database:** `MongoDB 7 vector search` + `../database/06-ms-biometric-db` (schema vacío) · **Puerto:** `8086` · **Dominio:** `06-data/domains/06-biometric.md`

## Decisión (ADR-005 §6)

**Best option: Python + FastAPI (22/25) — non-negotiable for CV workload.**

| # | Option | Perf | Eco | Learn | Lib | Ops | Total | Notes |
|---|--------|:----:|:---:|:-----:|:---:|:---:|-------|-------|
| **1** | **Python + FastAPI** | 4 | 5 | 4 | 5 | 4 | **22** | OpenCV canonical, face_recognition Python-first, pymongo vector, NumPy. |
| 2 | Python + Flask | 3 | 5 | 4 | 5 | 4 | 21 | Same eco, Flask less structured than FastAPI async. |
| 3 | TS + Fastify | 3 | 2 | 5 | 2 | 4 | 16 | opencv4nodejs fragile, face-api unmaintained. |
| 4 | TS + NestJS | 3 | 2 | 4 | 2 | 4 | 15 | Same + framework overhead. |
| 5 | Rust + Actix + opencv-rust | 5 | 2 | 1 | 2 | 3 | 13 | Fastest, 12mo ramp-up, bindings poorly documented. |

**Rationale:** OpenCV Python binding 10x more maintained; only real choice FastAPI vs Flask — FastAPI wins async for concurrent face-matching + auto OpenAPI for attendance integration.

## Estructura hexagonal (python-fastapi.md)

```
domain/
├── entities/ facial_embedding, fingerprint_embedding
├── value_objects/ model_version
├── events/ facial_enrolled
└── ports/in_/out/ enroll_use_case, embedding_repository
application/use_cases/ enroll_facial
infrastructure/
├── web/ routers/facial_router, schemas
├── persistence/ motor repositories
└── config/ settings, dependencies
```

## Dependencias (pyproject.toml)

FastAPI 0.110, Uvicorn, Pydantic 2, Motor (MongoDB), OpenCV, face_recognition, pymongo vector, structlog, pytest.

## Ejecución

```bash
poetry install && uvicorn main:app --reload --port 8086
```
