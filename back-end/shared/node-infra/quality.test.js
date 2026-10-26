'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createQualityAudit, classifyOperation, classifyISOClause } = require('./quality');

/** Minimal Fastify stand-in: keeps hooks and GET routes so a request can be replayed. */
function fakeApp() {
  const hooks = {};
  const routes = {};
  return {
    addHook: (name, fn) => (hooks[name] = fn),
    get: (path, fn) => (routes[path] = fn),
    async request(method, url, status) {
      const request = { method, url };
      await hooks.onRequest(request, {});
      return hooks.onSend(request, { statusCode: status }, 'body');
    },
    routes,
  };
}

test('operations and ISO clauses are classified from method, path and status', () => {
  assert.equal(classifyOperation('POST', '/api/v1/schools'), 'CREATE');
  assert.equal(classifyOperation('PATCH', '/api/v1/schools/1'), 'UPDATE');
  assert.equal(classifyOperation('GET', '/health/ready'), 'HEALTH');
  assert.equal(classifyOperation('GET', '/api/v1/quality/report'), 'METRICS');
  assert.equal(classifyOperation('OPTIONS', '/x'), 'OTHER');
  assert.equal(classifyISOClause(400), '8.2');
  assert.equal(classifyISOClause(403), '8.5');
  assert.equal(classifyISOClause(503), '10.2');
  assert.equal(classifyISOClause(302), '9.1');
});

test('each service keeps its own counters and the report reflects them', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const academic = createQualityAudit('03-ms-academic');
  const other = createQualityAudit('07-ms-configuration');
  const app = fakeApp();
  academic.registerQualityMiddleware(app);
  academic.registerQualityHealthEndpoint(app);

  assert.equal(await app.request('POST', '/api/v1/schools?x=1', 201), 'body');
  await app.request('GET', '/api/v1/schools', 200);
  await app.request('DELETE', '/api/v1/schools/1', 404);
  await app.request('PUT', '/api/v1/schools/1', 500);

  const report = await app.routes['/health/quality']();
  assert.equal(report.service, '03-ms-academic');
  assert.equal(report.kpis.total_operations, 4);
  assert.deepEqual(report.crud_operations, { creates: 1, reads: 1, updates: 1, deletes: 1 });
  assert.deepEqual(report.error_classification, { client_errors_4xx: 1, server_errors_5xx: 1, total_errors: 2 });
  assert.equal(report.kpis.availability_status, 'DEGRADED');
  assert.equal(other.buildQualityReport().kpis.total_operations, 0);

  // The audit line never carries the query string.
  const logged = console.log.mock.calls.map((c) => c.arguments[1]).join('\n');
  assert.doesNotMatch(logged, /\?x=1/);
});
