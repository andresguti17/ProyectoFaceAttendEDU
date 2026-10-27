'use strict';

/**
 * ISO/IEC 9001 quality audit for the Fastify services (clauses 8.5.2 / 9.1).
 *
 * Records every request with a correlation id, duration, CRUD kind and result, logs
 * one structured line per request (path without its query string) and exposes the
 * aggregated KPIs at /health/quality and /api/v1/quality/report.
 */

const { randomUUID } = require('node:crypto');

function classifyOperation(method, url) {
  if (url.includes('/health')) return 'HEALTH';
  if (url.includes('/quality')) return 'METRICS';
  switch (method) {
    case 'POST':
      return 'CREATE';
    case 'GET':
      return 'READ';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'OTHER';
  }
}

function classifyISOClause(status) {
  if (status === 400) return '8.2'; // requirements: validation
  if (status === 401 || status === 403 || status === 404 || status === 409) return '8.5'; // production
  if (status >= 500) return '10.2'; // nonconformity
  return '9.1'; // measurement
}

const CRUD_COUNTERS = { CREATE: 'createCount', READ: 'readCount', UPDATE: 'updateCount', DELETE: 'deleteCount' };

/** Audit hooks and report endpoints for one service; the metrics live in this closure. */
function createQualityAudit(serviceName) {
  const metrics = {
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

  function registerQualityMiddleware(app) {
    app.addHook('onRequest', async (request) => {
      request.quality = {
        correlationId: randomUUID(),
        startTime: Date.now(),
        operation: classifyOperation(request.method, request.url),
      };
    });

    app.addHook('onSend', async (request, reply, payload) => {
      const quality = request.quality;
      if (!quality) return payload;

      const duration = Date.now() - quality.startTime;
      const status = reply.statusCode;
      const isError = status >= 400;

      metrics.totalOperations++;
      metrics.totalDurationMs += duration;
      if (isError) {
        metrics.errorCount++;
        if (status >= 500) metrics.serverErrors++;
        else metrics.clientErrors++;
      } else {
        metrics.successCount++;
      }
      const counter = CRUD_COUNTERS[quality.operation];
      if (counter) metrics[counter]++;

      const logEntry = {
        correlationId: quality.correlationId,
        timestamp: new Date().toISOString(),
        service: serviceName,
        method: request.method,
        path: request.url.split('?')[0],
        status,
        duration,
        operation: quality.operation,
        error: isError,
        isoClause: isError ? classifyISOClause(status) : 'N/A',
      };
      if (isError) console.error('QUALITY_AUDIT_ERROR', JSON.stringify(logEntry));
      else console.log('QUALITY_AUDIT', JSON.stringify(logEntry));

      return payload;
    });
  }

  function buildQualityReport() {
    const total = metrics.totalOperations;
    const errorRate = total === 0 ? 0 : (metrics.errorCount / total) * 100;
    const avgResponseTime = total === 0 ? 0 : metrics.totalDurationMs / total;
    const availability = total === 0 ? 100 : (metrics.successCount / total) * 100;
    return {
      service: serviceName,
      timestamp: new Date().toISOString(),
      iso_compliance: 'ISO/IEC 9001:2015',
      kpis: {
        total_operations: total,
        success_count: metrics.successCount,
        error_count: metrics.errorCount,
        error_rate_pct: `${errorRate.toFixed(2)}%`,
        avg_response_time_ms: Number.parseFloat(avgResponseTime.toFixed(2)),
        availability_status: errorRate < 1 ? 'HEALTHY' : 'DEGRADED',
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

  function registerQualityHealthEndpoint(app) {
    app.get('/health/quality', async () => buildQualityReport());
    app.get('/api/v1/quality/report', async () => buildQualityReport());
  }

  return { registerQualityMiddleware, registerQualityHealthEndpoint, buildQualityReport };
}

module.exports = { createQualityAudit, classifyOperation, classifyISOClause };
