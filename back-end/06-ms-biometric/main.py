"""Biometric service entry point (FastAPI).

Routing contract
----------------
Business endpoints live under `/api/v1/biometric/...` because the API gateway
(`back-end/99-api-gateway/kong/kong.yml`, service `biometric-service`) forwards
`/api/v1/biometric` to `http://ms-biometric:8086` with `strip_path: false`.

Operational endpoints stay at the root: `back-end/docker-compose.yml` health-checks
this service with `wget -qO- http://localhost:8086/health`.

* `GET /health`       - liveness + last known dependency state. Always 200 while
                        the process can serve requests, so a MongoDB outage does
                        not get the container killed by its own healthcheck.
* `GET /health/live`  - liveness only, no I/O.
* `GET /health/ready` - readiness. 503 with `status: "degraded"` when MongoDB is
                        unreachable, disabled, or its indexes could not be created.

Persistence
-----------
MongoDB only. There is no in-memory fallback: when the database is unavailable
the affected request fails loudly with 503 (see
`infrastructure/persistence/errors.py`).
"""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError
from starlette.exceptions import HTTPException as StarletteHTTPException

from infrastructure.config.settings import get_settings
from infrastructure.persistence.errors import ConcurrencyConflictError, PersistenceError
from infrastructure.persistence.mongo_client import (
    STATUS_OK,
    MongoClient,
)
from infrastructure.web.routers.facial_router import router as facial_router
from infrastructure.web.routers.fingerprint_router import router as fingerprint_router
from infrastructure.web.routers.summary_router import router as summary_router
from infrastructure.web.routers.update_router import router as update_router
from infrastructure.web.routers.ws_router import router as ws_router
from infrastructure.web.ws.connection_manager import ConnectionManager
from infrastructure.web.ws.idempotency import IdempotencyCache

if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

logger = logging.getLogger("biometric")

STARTED_AT = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Own the MongoDB client for the whole process lifetime."""
    settings = get_settings()
    client = MongoClient(settings)
    app.state.mongo_client = client
    app.state.settings = settings
    # WS-only state: in-process, reset on every (re)start — no cross-replica
    # fan-out and no idempotency replay across a restart, documented in
    # infrastructure/web/routers/ws_router.py.
    app.state.ws_connection_manager = ConnectionManager()
    app.state.ws_idempotency_cache = IdempotencyCache(
        max_entries=settings.ws_idempotency_max_entries,
        ttl_seconds=settings.ws_idempotency_ttl_seconds,
    )
    await client.connect()  # never raises; failure is logged and reported by /health/ready
    try:
        yield
    finally:
        await client.disconnect()


app = FastAPI(title="Biometric Service", version="0.2.0", lifespan=lifespan)


@app.middleware("http")
async def iso25010_middleware(request: Request, call_next):
    # Seguridad/Mantenibilidad: correlación + medición de desempeño.
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    request.state.correlation_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["x-request-id"] = request_id
    response.headers["x-process-time-ms"] = str(elapsed_ms)
    # security-rules.md A05 — required security headers.
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["x-frame-options"] = "DENY"
    return response


def _error_body(error: str, message: str, request: Request, **extra) -> dict:
    """Uniform envelope: no stack traces or driver details reach the client."""
    body = {
        "error": error,
        "message": message,
        "path": str(request.url.path),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "correlationId": getattr(request.state, "correlation_id", None),
    }
    body.update(extra)
    return body


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # Fiabilidad/Compatibilidad: envolvente uniforme sin fuga de stack.
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(
            "NotFound" if exc.status_code == 404
            else "Unauthorized" if exc.status_code == 401
            else "Forbidden" if exc.status_code == 403
            else "BadRequest" if exc.status_code < 500
            else "InternalError",
            str(exc.detail),
            request,
        ),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=_error_body(
            "BadRequest", "Invalid biometric payload", request, details=exc.errors()
        ),
    )


@app.exception_handler(ConcurrencyConflictError)
async def concurrency_conflict_handler(request: Request, exc: ConcurrencyConflictError):
    # Two concurrent enrollments raced for the single active-template slot.
    logger.warning("Concurrency conflict on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=409,
        content=_error_body(
            "Conflict", "Concurrent biometric enrollment, please retry", request
        ),
    )


@app.exception_handler(PersistenceError)
async def persistence_error_handler(request: Request, exc: PersistenceError):
    """MongoDB disabled or not connected: refuse the request instead of guessing."""
    logger.error("Persistence unavailable for %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content=_error_body(
            "ServiceUnavailable", "Biometric persistence is unavailable", request
        ),
    )


@app.exception_handler(PyMongoError)
async def pymongo_error_handler(request: Request, exc: PyMongoError):
    """Any driver failure (server selection timeout, network, write error)."""
    logger.exception("MongoDB operation failed for %s", request.url.path)
    return JSONResponse(
        status_code=503,
        content=_error_body(
            "ServiceUnavailable", "Biometric persistence is unavailable", request
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content=_error_body("InternalError", "Unexpected internal error", request),
    )


def _health(service: str):
    return {
        "status": "ok",
        "service": service,
        "version": app.version,
        "uptimeSeconds": int(time.time() - STARTED_AT),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _mongo_client(request: Request) -> MongoClient | None:
    return getattr(request.app.state, "mongo_client", None)


app.include_router(facial_router)
app.include_router(fingerprint_router)
app.include_router(update_router)
app.include_router(summary_router)
app.include_router(ws_router)


@app.get("/health")
async def health(request: Request):
    """Liveness + last known dependency state. Never 503: Docker health-checks it."""
    payload = _health("biometric-service")
    client = _mongo_client(request)
    if client is None:
        payload["dependencies"] = {"mongodb": "down"}
        return payload
    mongo_status, detail = await client.health()
    payload["dependencies"] = {"mongodb": mongo_status}
    if mongo_status != STATUS_OK and detail:
        # Server-side detail only; the client gets the status, not the driver error.
        logger.warning("MongoDB dependency status=%s detail=%s", mongo_status, detail)
    return payload


@app.get("/health/live")
async def health_live():
    """Pure liveness probe — no dependency I/O."""
    return _health("biometric-service")


@app.get("/health/ready")
async def health_ready(request: Request):
    """Readiness probe. 503 + `status: degraded` unless MongoDB is fully usable."""
    client = _mongo_client(request)
    if client is None:
        mongo_status, detail = "down", "MongoDB client was never initialised"
    else:
        mongo_status, detail = await client.health()

    payload = {
        **_health("biometric-service"),
        "status": "ok" if mongo_status == STATUS_OK else "degraded",
        "dependencies": {"mongodb": mongo_status},
    }
    if mongo_status != STATUS_OK:
        logger.warning("Readiness degraded: mongodb=%s detail=%s", mongo_status, detail)
        return JSONResponse(status_code=503, content=payload)
    return payload


@app.get("/api/v1/health")
async def api_health(request: Request):
    return await health(request)


@app.get("/api/v1/biometric/health")
async def gateway_prefixed_health(request: Request):
    """Same payload as `/health`, reachable through Kong.

    Kong only forwards `/api/v1/biometric/*` to this service (`strip_path:
    false`); a bare `/health` or `/api/v1/health` has no route of its own here
    (unlike `ms-quality`'s dedicated `/health/quality` Kong route), so clients
    behind the gateway — including the merged biometric-capture front-end
    clients that used to hit `/face-auth/api/health` — need this alias under
    the one prefix Kong does proxy.
    """
    return await health(request)


# Run: uvicorn main:app --reload --port 8086
