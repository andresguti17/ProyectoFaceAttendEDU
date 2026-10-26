'use strict';

/**
 * HTTP baseline shared by the Fastify services: correlation id, security headers,
 * the JSON error envelope, the 404 body and the liveness/readiness endpoints.
 */

const { randomUUID } = require('node:crypto');
const { RepositoryError } = require('./errors');

// A caller-supplied id is echoed and logged: only a short, plain token is accepted.
const REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Error name rendered in the response envelope, by HTTP status. */
function errorNameFor(status) {
  switch (status) {
    case 400:
      return 'BadRequest';
    case 404:
      return 'NotFound';
    case 409:
      return 'Conflict';
    case 503:
      return 'ServiceUnavailable';
    default:
      return status >= 500 ? 'InternalError' : 'BadRequest';
  }
}

/**
 * @param app      the Fastify instance
 * @param options  { service: name shown by the health endpoints,
 *                   healthCheck: () => Promise<{ ok, latencyMs }> (the database probe) }
 */
function registerServiceBasics(app, { service, healthCheck }) {
  const startedAt = Date.now();
  const version = process.env.npm_package_version || '0.1.0';

  app.addHook('onRequest', async (req, reply) => {
    const supplied = req.headers['x-request-id'];
    const requestId = typeof supplied === 'string' && REQUEST_ID.test(supplied) ? supplied : randomUUID();
    req.requestId = requestId;
    reply.header('x-request-id', requestId);
  });
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('cache-control', 'no-store');
    return payload;
  });

  app.setErrorHandler((error, req, reply) => {
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    req.log.error({ err: error, path: req.url }, 'unhandled error');
    const details = error instanceof RepositoryError ? error.details : undefined;
    reply.code(status).send({
      error: errorNameFor(status),
      // Never echo a raw driver message for a server-side failure.
      message: status >= 500 && status !== 503 ? 'Unexpected internal error' : error.message,
      ...(details === undefined ? {} : { details }),
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  });
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'NotFound', message: `Route ${req.method} ${req.url} not found`, timestamp: new Date().toISOString() });
  });

  const liveness = async () => ({
    status: 'ok',
    service,
    version,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
  app.get('/health', liveness);
  app.get('/api/v1/health', liveness);

  // Readiness is separate from liveness: /health keeps answering 200 for the compose
  // healthcheck, /health/ready says whether PostgreSQL answers. It never shows the
  // connection (user, host, database) or the driver error: those stay in the log.
  app.get('/health/ready', async (_req, reply) => {
    const probe = await healthCheck();
    return reply.code(probe.ok ? 200 : 503).send({
      status: probe.ok ? 'ready' : 'not-ready',
      service,
      database: { connected: probe.ok, latencyMs: probe.latencyMs },
      timestamp: new Date().toISOString(),
    });
  });
}

module.exports = { registerServiceBasics, errorNameFor };
