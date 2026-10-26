'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerServiceBasics, errorNameFor } = require('./http');
const { ConflictError } = require('./errors');

/** Captures what registerServiceBasics installs on a Fastify instance. */
function fakeApp() {
  const app = { hooks: {}, routes: {} };
  app.addHook = (name, fn) => (app.hooks[name] = fn);
  app.get = (path, fn) => (app.routes[path] = fn);
  app.setErrorHandler = (fn) => (app.errorHandler = fn);
  app.setNotFoundHandler = (fn) => (app.notFoundHandler = fn);
  return app;
}

function fakeReply() {
  const reply = { headers: {}, statusCode: 200 };
  reply.header = (k, v) => (reply.headers[k] = v);
  reply.code = (c) => ((reply.statusCode = c), reply);
  reply.send = (body) => ((reply.body = body), reply);
  return reply;
}

const probe = (ok) => async () => ({ ok, latencyMs: 3 });

test('a plain caller request id is kept; anything else is replaced', async () => {
  const app = fakeApp();
  registerServiceBasics(app, { service: 'academic-service', healthCheck: probe(true) });
  for (const [supplied, kept] of [['abc-123', true], ['x'.repeat(65), false], ['a\r\nSet-Cookie: x', false], [undefined, false]]) {
    const req = { headers: { 'x-request-id': supplied } };
    const reply = fakeReply();
    await app.hooks.onRequest(req, reply);
    assert.equal(req.requestId === supplied, kept);
    assert.match(reply.headers['x-request-id'], /^[A-Za-z0-9._-]{1,64}$/);
  }
});

test('responses carry nosniff and no-store', async () => {
  const app = fakeApp();
  registerServiceBasics(app, { service: 's', healthCheck: probe(true) });
  const reply = fakeReply();
  assert.equal(await app.hooks.onSend({}, reply, 'p'), 'p');
  assert.equal(reply.headers['x-content-type-options'], 'nosniff');
  assert.equal(reply.headers['cache-control'], 'no-store');
});

test('server errors hide their message; client errors and repository details pass', () => {
  const app = fakeApp();
  registerServiceBasics(app, { service: 's', healthCheck: probe(true) });
  const req = { url: '/api/v1/x', log: { error() {} } };

  const crash = fakeReply();
  app.errorHandler(new Error('password=secret at db'), req, crash);
  assert.equal(crash.statusCode, 500);
  assert.equal(crash.body.message, 'Unexpected internal error');

  const conflict = fakeReply();
  app.errorHandler(new ConflictError('academic.school', 'uq_school_code', { detail: 'Key (code)=(S1)' }), req, conflict);
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.body.error, 'Conflict');
  assert.deepEqual(conflict.body.details, { entity: 'academic.school', constraint: 'uq_school_code' });

  const notFound = fakeReply();
  app.notFoundHandler({ method: 'GET', url: '/nope' }, notFound);
  assert.equal(notFound.statusCode, 404);
});

test('readiness answers status and latency only, never the connection or driver error', async () => {
  for (const ok of [true, false]) {
    const app = fakeApp();
    registerServiceBasics(app, { service: 'notification-service', healthCheck: probe(ok) });
    const reply = fakeReply();
    await app.routes['/health/ready']({}, reply);
    assert.equal(reply.statusCode, ok ? 200 : 503);
    assert.deepEqual(reply.body.database, { connected: ok, latencyMs: 3 });
    assert.deepEqual(Object.keys(reply.body).sort(), ['database', 'service', 'status', 'timestamp']);
  }
  const app = fakeApp();
  registerServiceBasics(app, { service: 'academic-service', healthCheck: probe(true) });
  assert.equal((await app.routes['/health']()).service, 'academic-service');
  assert.equal((await app.routes['/api/v1/health']()).status, 'ok');
});

test('error names follow the status', () => {
  assert.equal(errorNameFor(400), 'BadRequest');
  assert.equal(errorNameFor(404), 'NotFound');
  assert.equal(errorNameFor(409), 'Conflict');
  assert.equal(errorNameFor(503), 'ServiceUnavailable');
  assert.equal(errorNameFor(502), 'InternalError');
  assert.equal(errorNameFor(422), 'BadRequest');
});
