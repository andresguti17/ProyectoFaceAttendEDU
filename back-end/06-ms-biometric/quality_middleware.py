"""
ISO/IEC 9001 — Quality Audit Middleware for FastAPI (Cláusula 8.5.2 / 9.1)

Registra cada operación CRUD con metadata completa para trazabilidad:
- correlation_id único por request
- Timestamp de inicio y fin
- Duración de la operación
- Método HTTP y path
- Status code de respuesta
- Clasificación del resultado (éxito/error)

Los registros se almacenan en memoria y se exponen vía /health/quality
"""

import time
import uuid
from datetime import datetime, timezone
from typing import Optional
from collections import defaultdict
from dataclasses import dataclass, field
import logging

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("QUALITY_AUDIT")


# ── Quality Metrics Store ──────────────────────────────────────

@dataclass
class QualityMetrics:
    total_operations: int = 0
    success_count: int = 0
    error_count: int = 0
    client_errors: int = 0  # 4xx
    server_errors: int = 0  # 5xx
    create_count: int = 0   # POST
    read_count: int = 0     # GET
    update_count: int = 0   # PUT/PATCH
    delete_count: int = 0   # DELETE
    total_duration_ms: int = 0

    def record_operation(self, operation: str, status: int, duration_ms: int):
        self.total_operations += 1
        self.total_duration_ms += duration_ms

        if status >= 400:
            self.error_count += 1
            if status >= 500:
                self.server_errors += 1
            else:
                self.client_errors += 1
        else:
            self.success_count += 1

        if operation == "CREATE":
            self.create_count += 1
        elif operation == "READ":
            self.read_count += 1
        elif operation == "UPDATE":
            self.update_count += 1
        elif operation == "DELETE":
            self.delete_count += 1

    def to_dict(self) -> dict:
        return {
            "total_operations": self.total_operations,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "client_errors_4xx": self.client_errors,
            "server_errors_5xx": self.server_errors,
            "creates": self.create_count,
            "reads": self.read_count,
            "updates": self.update_count,
            "deletes": self.delete_count,
            "total_duration_ms": self.total_duration_ms,
        }

    @property
    def error_rate(self) -> float:
        if self.total_operations == 0:
            return 0.0
        return self.error_count / self.total_operations * 100

    @property
    def avg_response_time_ms(self) -> float:
        if self.total_operations == 0:
            return 0.0
        return self.total_duration_ms / self.total_operations

    @property
    def availability(self) -> float:
        if self.total_operations == 0:
            return 100.0
        return self.success_count / self.total_operations * 100


quality_metrics = QualityMetrics()


# ── ISO 9001 Classifications ──────────────────────────────────

def classify_operation(method: str, url: str) -> str:
    if url.startswith("/health"):
        return "HEALTH"
    if url.startswith("/quality"):
        return "METRICS"

    operation_map = {
        "POST": "CREATE",
        "GET": "READ",
        "PUT": "UPDATE",
        "PATCH": "UPDATE",
        "DELETE": "DELETE",
    }
    return operation_map.get(method, "OTHER")


def classify_iso_clause(status: int) -> str:
    if status == 400:
        return "8.2"  # Requirements — validation
    if status in (401, 403):
        return "8.5"  # Production — auth
    if status == 404:
        return "8.5"  # Production — not found
    if status == 409:
        return "8.5"  # Production — duplicate
    if status >= 500:
        return "10.2"  # Nonconformity
    return "9.1"  # Measurement


# ── Quality Middleware ─────────────────────────────────────────

class QualityAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = str(uuid.uuid4())
        start_time = time.time()
        operation = classify_operation(request.method, request.url.path)

        # Set quality context on request state
        request.state.quality = {
            "correlation_id": correlation_id,
            "start_time": start_time,
            "operation": operation,
        }

        try:
            response = await call_next(request)
            status = response.status_code
        except Exception as exc:
            status = 500
            raise
        finally:
            duration_ms = int((time.time() - start_time) * 1000)
            is_error = status >= 400

            # Record metrics
            quality_metrics.record_operation(operation, status, duration_ms)

            # Structured audit log entry
            log_entry = {
                "correlationId": correlation_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "service": "06-ms-biometric",
                "method": request.method,
                "path": request.url.path.split("?")[0],
                "status": status,
                "duration": duration_ms,
                "operation": operation,
                "error": is_error,
                "isoClause": classify_iso_clause(status) if is_error else "N/A",
            }

            if is_error:
                logger.error("QUALITY_AUDIT_ERROR %s", str(log_entry))
            else:
                logger.info("QUALITY_AUDIT %s", str(log_entry))

        return response


# ── Quality Health Endpoint ────────────────────────────────────

def register_quality_health_endpoint(app: FastAPI):
    @app.get("/health/quality")
    @app.get("/api/v1/quality/report")
    async def quality_report():
        error_rate = quality_metrics.error_rate
        avg_response_time = quality_metrics.avg_response_time_ms
        availability = quality_metrics.availability

        return {
            "service": "06-ms-biometric",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "iso_compliance": "ISO/IEC 9001:2015",
            "kpis": {
                "total_operations": quality_metrics.total_operations,
                "success_count": quality_metrics.success_count,
                "error_count": quality_metrics.error_count,
                "error_rate_pct": f"{error_rate:.2f}%",
                "avg_response_time_ms": f"{avg_response_time:.2f}",
                "availability_status": "HEALTHY" if error_rate < 1.0 else "DEGRADED",
            },
            "crud_operations": {
                "creates": quality_metrics.create_count,
                "reads": quality_metrics.read_count,
                "updates": quality_metrics.update_count,
                "deletes": quality_metrics.delete_count,
            },
            "error_classification": {
                "client_errors_4xx": quality_metrics.client_errors,
                "server_errors_5xx": quality_metrics.server_errors,
                "total_errors": quality_metrics.error_count,
            },
            "iso_clauses_status": {
                "clause_4_4_context": "ACTIVE",
                "clause_8_2_requirements": "ACTIVE",
                "clause_8_5_production": "ACTIVE",
                "clause_9_1_measurement": "ACTIVE",
                "clause_10_2_corrective": "ACTIVE",
                "clause_7_5_documentation": "ACTIVE",
            },
            "availability_pct": f"{availability:.2f}%",
            "target_availability": "99.5%",
            "meets_target": availability >= 99.5,
        }
