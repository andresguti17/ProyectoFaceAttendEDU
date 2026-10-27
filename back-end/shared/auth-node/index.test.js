'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerAuthGuard, clearAuthCache } = require('./index');

const TOKEN = '11111111-2222-3333-4444-555555555555';
const USER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function json(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** Registers the guard on a fake app and returns a function that runs one request. */
function guard(rule, options) {
  let hook;
  registerAuthGuard({ addHook: (_name, fn) => { hook = fn; } }, rule, options);
  return async (method, url, headers = { authorization: `Bearer ${TOKEN}` }, extra = {}) => {
    const req = { method, url, headers, ...extra };
    const reply = { statusCode: 200, body: null, code(s) { this.statusCode = s; return this; }, send(b) { this.body = b; return this; } };
    await hook(req, reply);
    return { req, reply };
  };
}

function stubFetch(routes) {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    for (const [part, answer] of routes) {
      if (url.includes(part)) {
        if (answer instanceof Error) throw answer;
        return answer;
      }
    }
    return json(404, null);
  };
  return calls;
}

test.beforeEach(() => clearAuthCache());

test('health and non-api paths skip the guard', async () => {
  const calls = stubFetch([]);
  const run = guard(() => 'x:read');
  assert.equal((await run('GET', '/health', {})).reply.statusCode, 200);
  assert.equal((await run('GET', '/metrics', {})).reply.statusCode, 200);
  assert.equal((await run('OPTIONS', '/api/v1/a', {})).reply.statusCode, 200);
  assert.equal(calls.length, 0);
});

test('missing or malformed bearer is 401 without calling identity', async () => {
  const calls = stubFetch([]);
  const run = guard(() => null);
  assert.equal((await run('GET', '/api/v1/a', {})).reply.body.message, 'Missing bearer token');
  assert.equal((await run('GET', '/api/v1/a', { authorization: 'Bearer nope' })).reply.body.message, 'Invalid token format');
  assert.equal(calls.length, 0);
});

test('active session plus allowed permission passes, sets the caller and is cached', async () => {
  const calls = stubFetch([
    ['/sessions/', json(200, { sessionStatus: 'Active', userId: USER })],
    ['/auth/evaluate', json(200, { allowed: true })],
  ]);
  const run = guard(() => 'x:read');
  const first = await run('GET', '/api/v1/a?limit=5');
  await run('GET', '/api/v1/a');
  assert.equal(first.reply.statusCode, 200);
  assert.equal(first.req.userId, USER);
  assert.equal(first.req.authToken, TOKEN);
  assert.equal(calls.length, 2);
});

test('denied permission is 403 and is not cached', async () => {
  const calls = stubFetch([
    ['/sessions/', json(200, { sessionStatus: 'Active', userId: USER })],
    ['/auth/evaluate', json(200, { allowed: false })],
  ]);
  const run = guard(() => 'x:write');
  assert.equal((await run('POST', '/api/v1/a')).reply.statusCode, 403);
  assert.equal((await run('POST', '/api/v1/a')).reply.statusCode, 403);
  assert.equal(calls.filter((u) => u.includes('/auth/evaluate')).length, 2);
});

test('closed session is 401; identity down is 503; authorization down is 503', async () => {
  stubFetch([['/sessions/', json(200, { sessionStatus: 'Closed', userId: USER })]]);
  assert.equal((await guard(() => null)('GET', '/api/v1/a')).reply.statusCode, 401);

  clearAuthCache();
  stubFetch([['/sessions/', new Error('down')]]);
  assert.equal((await guard(() => null)('GET', '/api/v1/a')).reply.statusCode, 503);

  clearAuthCache();
  stubFetch([['/sessions/', json(200, { sessionStatus: 'Active', userId: USER })], ['/auth/evaluate', new Error('down')]]);
  assert.equal((await guard(() => 'x:read')('GET', '/api/v1/a')).reply.statusCode, 503);
});

test('options let a service guard every path on the routed URL', async () => {
  stubFetch([]);
  const run = guard(() => null, {
    isPublic: (path) => path === '/health',
    resolvePath: (req) => req.routeOptions?.url ?? req.url,
  });
  const routed = await run('GET', '/%61pi/v1/alerts', {}, { routeOptions: { url: '/api/v1/alerts' } });
  assert.equal(routed.reply.statusCode, 401);
  assert.equal(routed.reply.body.path, '/api/v1/alerts');
  assert.equal((await run('GET', '/not-api', {})).reply.statusCode, 401);
  assert.equal((await run('GET', '/health', {})).reply.statusCode, 200);
});

test('a percent-encoded /api path is guarded like the decoded one the router runs', async () => {
  const calls = stubFetch([]);
  const run = guard(() => null);
  const encoded = await run('GET', '/%61pi/v1/configurations/academic/1', {});
  assert.equal(encoded.reply.statusCode, 401);
  assert.equal(encoded.reply.body.path, '/api/v1/configurations/academic/1');
  assert.equal(calls.length, 0);
});

test('permission rules see the decoded path, so encoding cannot dodge them', async () => {
  stubFetch([
    ['/sessions/', json(200, { sessionStatus: 'Active', userId: USER })],
    ['/auth/evaluate', json(200, { allowed: false })],
  ]);
  const seen = [];
  const run = guard((_method, path) => {
    seen.push(path);
    return path.startsWith('/api/v1/configurations/academic') ? 'configuration:manage' : null;
  });
  assert.equal((await run('GET', '/api/v1/%63onfigurations/academic/1')).reply.statusCode, 403);
  assert.deepEqual(seen, ['/api/v1/configurations/academic/1']);
});

test('ambiguous or malformed paths are 400 without calling identity', async () => {
  const calls = stubFetch([]);
  const run = guard(() => null);
  for (const url of ['/api/v1/a%2Fb', '/api/v1/a%5cb', '/api/v1/a%252f', '/api/v1/a;x=1', '/api/v1/%E0%A4%A']) {
    const { reply } = await run('GET', url);
    assert.equal(reply.statusCode, 400, url);
    assert.equal(reply.body.error, 'Bad Request');
  }
  assert.equal(calls.length, 0);
});

test('a throwing custom resolvePath is 400, not an unhandled error', async () => {
  stubFetch([]);
  const run = guard(() => null, { resolvePath: (req) => decodeURIComponent(req.url) });
  assert.equal((await run('GET', '/api/v1/%E0%A4%A')).reply.statusCode, 400);
});
