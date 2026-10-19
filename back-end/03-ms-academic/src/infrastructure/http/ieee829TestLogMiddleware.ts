/**
 * IEEE 829 — Test Log Middleware for Fastify (Cláusula 6 - Test Log)
 *
 * Registra cada operación CRUD como evento de prueba conforme al estándar IEEE 829:
 * - Test ID correlation
 * - Timestamp de ejecución
 * - Input/Output logging
 * - Assertion results
 * - Duration tracking
 *
 * Los registros se almacenan y exponen vía /api/v1/quality/test-log
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ── Test Log Store ─────────────────────────────────────────────

interface TestLogEntry {
  testId: string;
  timestamp: string;
  service: string;
  method: string;
  endpoint: string;
  requestBody?: unknown;
  responseBody?: unknown;
  statusCode: number;
  duration: number;
  assertions: AssertionResult[];
  status: 'PASS' | 'FAIL';
  correlationId: string;
}

interface AssertionResult {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

// In-memory test log store (last 1000 entries)
const testLogStore: TestLogEntry[] = [];
const MAX_LOG_ENTRIES = 1000;

// ── Test ID Generator ─────────────────────────────────────────

function generateTestId(method: string, path: string): string {
  const entity = path.split('/').filter(Boolean).pop() || 'unknown';
  const operation = method.toLowerCase();
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `TC-AUTO-${entity}-${operation}-${timestamp}`;
}

// ── Assertion Evaluators ──────────────────────────────────────

function evaluateAssertions(
  statusCode: number,
  responseBody: unknown,
  method: string
): AssertionResult[] {
  const assertions: AssertionResult[] = [];

  // Status code assertions
  if (method === 'POST') {
    assertions.push({
      name: 'Create returns 201',
      expected: '201',
      actual: String(statusCode),
      passed: statusCode === 201,
    });
  } else if (method === 'GET') {
    assertions.push({
      name: 'Read returns 200',
      expected: '200',
      actual: String(statusCode),
      passed: statusCode === 200,
    });
  } else if (method === 'PUT' || method === 'PATCH') {
    assertions.push({
      name: 'Update returns 200',
      expected: '200',
      actual: String(statusCode),
      passed: statusCode === 200,
    });
  } else if (method === 'DELETE') {
    assertions.push({
      name: 'Delete returns 204',
      expected: '204',
      actual: String(statusCode),
      passed: statusCode === 204,
    });
  }

  // Response body assertions
  if (statusCode >= 200 && statusCode < 300 && method !== 'DELETE') {
    const body = responseBody as Record<string, unknown>;
    const hasBody = body && typeof body === 'object' && Object.keys(body).length > 0;
    assertions.push({
      name: 'Response body is not empty',
      expected: 'non-empty object',
      actual: hasBody ? 'non-empty' : 'empty',
      passed: !!hasBody,
    });
  }

  // Error response assertions
  if (statusCode >= 400) {
    const body = responseBody as Record<string, unknown>;
    const hasError = body && (body.error || body.message);
    assertions.push({
      name: 'Error response has message',
      expected: 'error or message field',
      actual: hasError ? 'present' : 'missing',
      passed: !!hasError,
    });
  }

  return assertions;
}

// ── IEEE 829 Test Log Middleware ───────────────────────────────

export function registerIEEE829TestLogMiddleware(app: FastifyInstance): void {
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    const testId = generateTestId(request.method, request.url);
    (request as any).ieee829 = {
      testId,
      startTime: Date.now(),
      correlationId: crypto.randomUUID(),
    };
  });

  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: string) => {
    const ieee829 = (request as any).ieee829;
    if (!ieee829) return payload;

    const duration = Date.now() - ieee829.startTime;
    const statusCode = reply.statusCode;
    let responseBody: unknown;

    try {
      responseBody = JSON.parse(payload);
    } catch {
      responseBody = payload;
    }

    // Evaluate assertions
    const assertions = evaluateAssertions(statusCode, responseBody, request.method);
    const allPassed = assertions.every(a => a.passed);

    // Create test log entry
    const logEntry: TestLogEntry = {
      testId: ieee829.testId,
      timestamp: new Date().toISOString(),
      service: '03-ms-academic',
      method: request.method,
      endpoint: request.url.split('?')[0],
      requestBody: undefined, // Don't log sensitive data
      responseBody: statusCode >= 400 ? responseBody : undefined,
      statusCode,
      duration,
      assertions,
      status: allPassed ? 'PASS' : 'FAIL',
      correlationId: ieee829.correlationId,
    };

    // Store log entry
    testLogStore.unshift(logEntry);
    if (testLogStore.length > MAX_LOG_ENTRIES) {
      testLogStore.pop();
    }

    // Structured log output
    const logLine = {
      ...logEntry,
      responseBody: undefined, // Don't log full body in production
    };
    if (allPassed) {
      console.log('IEEE829_TEST_PASS', JSON.stringify(logLine));
    } else {
      console.error('IEEE829_TEST_FAIL', JSON.stringify(logLine));
    }

    return payload;
  });
}

// ── IEEE 829 Test Log Endpoints ───────────────────────────────

export function registerIEEE829TestLogEndpoints(app: FastifyInstance): void {
  // GET /api/v1/quality/test-log — Retrieve test log entries
  app.get('/api/v1/quality/test-log', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { limit?: string; offset?: string; status?: string };
    const limit = Math.min(parseInt(query.limit || '50', 10), 100);
    const offset = parseInt(query.offset || '0', 10);
    const statusFilter = query.status;

    let entries = [...testLogStore];

    // Apply status filter
    if (statusFilter) {
      entries = entries.filter(e => e.status === statusFilter.toUpperCase());
    }

    // Apply pagination
    const total = entries.length;
    const paginated = entries.slice(offset, offset + limit);

    // Calculate summary stats
    const totalTests = testLogStore.length;
    const passedTests = testLogStore.filter(e => e.status === 'PASS').length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return reply.send({
      summary: {
        total_tests: totalTests,
        passed: passedTests,
        failed: failedTests,
        pass_rate: `${passRate.toFixed(2)}%`,
        ieee829_compliance: 'IEEE 829-1998',
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      entries: paginated,
    });
  });

  // GET /api/v1/quality/test-log/:testId — Get specific test log
  app.get('/api/v1/quality/test-log/:testId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { testId } = request.params as { testId: string };
    const entry = testLogStore.find(e => e.testId === testId);

    if (!entry) {
      return reply.code(404).send({ error: 'Test log entry not found' });
    }

    return reply.send(entry);
  });

  // GET /api/v1/quality/test-summary — IEEE 829 Test Summary Report
  app.get('/api/v1/quality/test-summary', async () => {
    const totalTests = testLogStore.length;
    const passedTests = testLogStore.filter(e => e.status === 'PASS').length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    // Group by service
    const byService: Record<string, { total: number; passed: number; failed: number }> = {};
    for (const entry of testLogStore) {
      if (!byService[entry.service]) {
        byService[entry.service] = { total: 0, passed: 0, failed: 0 };
      }
      byService[entry.service].total++;
      if (entry.status === 'PASS') byService[entry.service].passed++;
      else byService[entry.service].failed++;
    }

    // Group by endpoint
    const byEndpoint: Record<string, { total: number; avgDuration: number }> = {};
    for (const entry of testLogStore) {
      if (!byEndpoint[entry.endpoint]) {
        byEndpoint[entry.endpoint] = { total: 0, avgDuration: 0 };
      }
      byEndpoint[entry.endpoint].total++;
      byEndpoint[entry.endpoint].avgDuration =
        (byEndpoint[entry.endpoint].avgDuration * (byEndpoint[entry.endpoint].total - 1) + entry.duration) /
        byEndpoint[entry.endpoint].total;
    }

    return {
      report_type: 'IEEE 829 Test Summary Report',
      generated_at: new Date().toISOString(),
      summary: {
        total_tests: totalTests,
        passed: passedTests,
        failed: failedTests,
        pass_rate: `${passRate.toFixed(2)}%`,
        target_pass_rate: '95%',
        meets_target: passRate >= 95,
      },
      by_service: byService,
      by_endpoint: byEndpoint,
      recent_failures: testLogStore
        .filter(e => e.status === 'FAIL')
        .slice(0, 10)
        .map(e => ({
          test_id: e.testId,
          endpoint: e.endpoint,
          timestamp: e.timestamp,
          assertions_failed: e.assertions.filter(a => !a.passed).map(a => a.name),
        })),
    };
  });
}
