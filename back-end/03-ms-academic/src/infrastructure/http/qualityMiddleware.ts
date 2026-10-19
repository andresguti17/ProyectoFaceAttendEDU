/**
 * ISO/IEC 9001 — Quality Audit Middleware for Fastify (Cláusula 8.5.2 / 9.1)
 *
 * Registra cada operación CRUD con metadata completa para trazabilidad:
 * - correlationId único por request
 * - Timestamp de inicio y fin
 * - Duración de la operación
 * - Método HTTP y path
 * - Status code de respuesta
 * - Clasificación del resultado (éxito/error)
 *
 * Los registros se almacenan en memoria y se exponen vía /health/quality
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ── Quality Metrics Store ──────────────────────────────────────

interface QualityMetrics {
  totalOperations: number;
  successCount: number;
  errorCount: number;
  clientErrors: number;  // 4xx
  serverErrors: number;  // 5xx
  createCount: number;   // POST
  readCount: number;     // GET
  updateCount: number;   // PUT/PATCH
  deleteCount: number;   // DELETE
  totalDurationMs: number;
}

const metrics: QualityMetrics = {
  totalOperations: 0,
  successCount: 0,
  errorCount: 0,
  clientErrors: 0,
  serverErrors: 0,
  createCount: 0,
  readCount: 0,
  updateCount: 0,
  deleteCount: 0,
  totalDurationMs: 0,
};

// ── ISO 9001 Error Codes ──────────────────────────────────────

function classifyOperation(method: string, url: string): string {
  if (url.includes('/health')) return 'HEALTH';
  if (url.includes('/quality')) return 'METRICS';
  switch (method) {
    case 'POST':   return 'CREATE';
    case 'GET':    return 'READ';
    case 'PUT':
    case 'PATCH':  return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default:       return 'OTHER';
  }
}

function classifyISOClause(status: number): string {
  if (status === 400) return '8.2';  // Requirements — validation
  if (status === 401 || status === 403) return '8.5';  // Production — auth
  if (status === 404) return '8.5';  // Production — not found
  if (status === 409) return '8.5';  // Production — duplicate
  if (status >= 500) return '10.2'; // Nonconformity
  return '9.1';  // Measurement
}

function classifyErrorCode(status: number): string {
  if (status === 400) return 'ISO-8.2-VAL-001';
  if (status === 401 || status === 403) return 'ISO-8.5-AUTH-001';
  if (status === 404) return 'ISO-8.5-INT-001';
  if (status === 409) return 'ISO-8.5-DUP-001';
  if (status >= 500) return 'ISO-10.2-NC-001';
  return 'ISO-9.1-MET-001';
}

// ── Quality Middleware ─────────────────────────────────────────

export function registerQualityMiddleware(app: FastifyInstance): void {
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    const correlationId = crypto.randomUUID();
    const startTime = Date.now();
    const operation = classifyOperation(request.method, request.url);

    // Attach quality context to request
    (request as any).quality = { correlationId, startTime, operation };
  });

  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: string) => {
    const quality = (request as any).quality;
    if (!quality) return payload;

    const duration = Date.now() - quality.startTime;
    const status = reply.statusCode;
    const isError = status >= 400;

    // Update metrics
    metrics.totalOperations++;
    metrics.totalDurationMs += duration;

    if (isError) {
      metrics.errorCount++;
      if (status >= 500) metrics.serverErrors++;
      else metrics.clientErrors++;
    } else {
      metrics.successCount++;
    }

    // Track CRUD operation counts
    switch (quality.operation) {
      case 'CREATE': metrics.createCount++; break;
      case 'READ':   metrics.readCount++; break;
      case 'UPDATE': metrics.updateCount++; break;
      case 'DELETE': metrics.deleteCount++; break;
    }

    // Structured audit log entry
    const logEntry = {
      correlationId: quality.correlationId,
      timestamp: new Date().toISOString(),
      service: '03-ms-academic',
      method: request.method,
      path: request.url.split('?')[0],
      status,
      duration,
      operation: quality.operation,
      error: isError,
      isoClause: isError ? classifyISOClause(status) : 'N/A',
    };

    if (isError) {
      console.error('QUALITY_AUDIT_ERROR', JSON.stringify(logEntry));
    } else {
      console.log('QUALITY_AUDIT', JSON.stringify(logEntry));
    }

    return payload;
  });
}

// ── Quality Health Endpoint ────────────────────────────────────

export function registerQualityHealthEndpoint(app: FastifyInstance): void {
  app.get('/health/quality', async () => buildQualityReport('03-ms-academic'));
  app.get('/api/v1/quality/report', async () => buildQualityReport('03-ms-academic'));
}

function buildQualityReport(serviceName: string) {
  const errorRate = metrics.totalOperations === 0
    ? 0.0
    : (metrics.errorCount / metrics.totalOperations) * 100;

  const avgResponseTime = metrics.totalOperations === 0
    ? 0.0
    : metrics.totalDurationMs / metrics.totalOperations;

  const availability = metrics.totalOperations === 0
    ? 100.0
    : (metrics.successCount / metrics.totalOperations) * 100;

  return {
    service: serviceName,
    timestamp: new Date().toISOString(),
    iso_compliance: 'ISO/IEC 9001:2015',
    kpis: {
      total_operations: metrics.totalOperations,
      success_count: metrics.successCount,
      error_count: metrics.errorCount,
      error_rate_pct: `${errorRate.toFixed(2)}%`,
      avg_response_time_ms: parseFloat(avgResponseTime.toFixed(2)),
      availability_status: errorRate < 1.0 ? 'HEALTHY' : 'DEGRADED',
    },
    crud_operations: {
      creates: metrics.createCount,
      reads: metrics.readCount,
      updates: metrics.updateCount,
      deletes: metrics.deleteCount,
    },
    error_classification: {
      client_errors_4xx: metrics.clientErrors,
      server_errors_5xx: metrics.serverErrors,
      total_errors: metrics.errorCount,
    },
    iso_clauses_status: {
      clause_4_4_context: 'ACTIVE',
      clause_8_2_requirements: 'ACTIVE',
      clause_8_5_production: 'ACTIVE',
      clause_9_1_measurement: 'ACTIVE',
      clause_10_2_corrective: 'ACTIVE',
      clause_7_5_documentation: 'ACTIVE',
    },
    availability_pct: `${availability.toFixed(2)}%`,
    target_availability: '99.5%',
    meets_target: availability >= 99.5,
  };
}
