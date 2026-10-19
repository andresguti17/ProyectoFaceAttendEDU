import type { FastifyInstance } from 'fastify';

// Best-effort Kafka hook (mismo patrón que academic/configuration): no bloquea el CRUD.
export function registerEventHook(app: FastifyInstance) {
  app.addHook('onResponse', async (req) => {
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') && req.url.includes('/api/v1/quality/')) {
      req.log.info({ url: req.url, method: req.method }, 'quality domain event (best-effort)');
    }
  });
}
