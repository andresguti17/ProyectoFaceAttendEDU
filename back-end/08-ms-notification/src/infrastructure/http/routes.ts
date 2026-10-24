import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ALERT_TYPE_CHANNELS } from '../../domain/entities/AlertType';
import type { IAlertRepository } from '../../domain/ports/out/IAlertRepository';
import type { IAlertTypeRepository } from '../../domain/ports/out/IAlertTypeRepository';
import { actorAllowed, resolveActorScope, resolveOwnActorIds, ScopeError } from './actorScope';
import {
  DEVICE_LOCALES,
  DEVICE_PLATFORMS,
  type IDeviceTokenRepository,
} from '../../domain/ports/out/IDeviceTokenRepository';
import { notifyWebhook, webhookConfigFromEnv, WEBHOOK_NOT_CONFIGURED, type WebhookPayload } from '../webhook/notifier';
import { sendEmail, SMTP_NOT_CONFIGURED, type SmtpConfig } from '../email/sender';
import { render, subjectFor, SUPPORTED_TEMPLATES } from '../email/render';

/**
 * HTTP adapters — 08-ms-notification.
 *
 * Ports `internal/infrastructure/http/handler/{alert,alert_type}_handler.go`
 * to Fastify. Persistence goes through the injected `IAlertRepository` /
 * `IAlertTypeRepository`; a `RepositoryError` or `ScopeError` thrown by a
 * handler is not caught here — `main.ts`'s Fastify error handler renders it,
 * the same contract `03-ms-academic/src/infrastructure/http/routes.ts` uses.
 */

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function send400(reply: any, message: string, details?: unknown) {
  return reply.code(400).send({ error: 'BadRequest', message, details, timestamp: new Date().toISOString() });
}

function notFound(reply: any) {
  return reply.code(404).send({ error: 'NotFound' });
}

function forbidden(reply: any) {
  return reply.code(403).send({ error: 'Forbidden', message: 'Forbidden: outside your scope', timestamp: new Date().toISOString() });
}

function getLimitOffset(req: any): { limit: number; offset: number } {
  const q = (req as any)?.query as any;
  let limit = Number(q?.limit ?? 50);
  let offset = Number(q?.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 0) limit = 50;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

/** `?resolved=` bool, or the `?status=resolved|open|pending` alias — mirrors the Go handler. */
function resolvedFilterFrom(query: any): boolean | undefined {
  if (query?.resolved !== undefined) {
    return String(query.resolved).toLowerCase() === 'true';
  }
  const status = typeof query?.status === 'string' ? query.status.toLowerCase() : undefined;
  if (status === 'resolved') return true;
  if (status === 'open' || status === 'pending') return false;
  return undefined;
}

/** Runs a scope resolver; on a ScopeError answers it and resolves `undefined`. */
async function resolveOrReply<T>(reply: any, resolve: () => Promise<T>): Promise<T | undefined> {
  try {
    return await resolve();
  } catch (err) {
    if (err instanceof ScopeError) {
      reply.code(err.statusCode).send({ error: err.statusCode === 403 ? 'Forbidden' : 'ServiceUnavailable', message: err.message, timestamp: new Date().toISOString() });
      return undefined;
    }
    throw err;
  }
}

function scopeOf(req: any, reply: any): Promise<Set<number> | null | undefined> {
  return resolveOrReply(reply, () => resolveActorScope(req));
}

const createAlertBody = z.object({
  academicActorId: z.number().int().positive(),
  alertTypeId: z.number().int().positive(),
});

const createAlertTypeBody = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  severity: z.string().min(1),
  channel: z.enum(ALERT_TYPE_CHANNELS).optional(),
});

const updateAlertTypeBody = createAlertTypeBody.partial();

export async function registerNotificationRoutes(
  app: FastifyInstance,
  repos: { alerts: IAlertRepository; alertTypes: IAlertTypeRepository },
): Promise<void> {
  // ---------- Alerts ----------
  function registerAlertRoutes(base: string) {
    app.post(base, async (req, reply) => {
      const parsed = createAlertBody.safeParse((req as any).body);
      if (!parsed.success) return send400(reply, 'Invalid alert payload', parsed.error.flatten());

      const alertType = await repos.alertTypes.findById(parsed.data.alertTypeId);
      if (!alertType) return notFound(reply);

      const created = await repos.alerts.create({
        academicActorId: parsed.data.academicActorId,
        alertTypeId: parsed.data.alertTypeId,
        raisedAt: new Date().toISOString(),
        resolvedAt: null,
      } as any);

      // Only EMAIL/PUSH need an external delivery; DASHBOARD (and any legacy
      // in-app value) is shown in the app only. Fire-and-forget, detached from
      // this request: a slow or unreachable receiver must never make alert
      // creation time out, so this is deliberately not awaited before the
      // response is sent (ports the Go `go notifyAsync(...)` fire-and-forget
      // dispatch).
      if (alertType && (alertType.channel === 'EMAIL' || alertType.channel === 'PUSH')) {
        const payload: WebhookPayload = {
          alertId: (created as any).alertId,
          academicActorId: created.academicActorId,
          alertTypeId: created.alertTypeId,
          alertTypeCode: alertType.code,
          severity: alertType.severity,
          channel: alertType.channel,
          raisedAt: created.raisedAt,
        };
        notifyWebhook(webhookConfigFromEnv(), payload).catch((err) => {
          if (err !== WEBHOOK_NOT_CONFIGURED) {
            app.log.error({ err, alertId: payload.alertId }, 'alert webhook delivery failed');
          }
        });
      }

      return reply.code(201).send({ alert_id: (created as any).alertId });
    });

    app.get(base, async (req, reply) => {
      const scope = await scopeOf(req, reply);
      if (scope === undefined) return reply;
      const query = (req as any).query as any;
      const { limit, offset } = getLimitOffset(req);
      const actorId = query?.actorId !== undefined ? Number(query.actorId) : undefined;
      const typeId = query?.typeId !== undefined ? Number(query.typeId) : undefined;
      const resolved = resolvedFilterFrom(query);

      // actorId/typeId/resolved narrow the SQL query itself, combined with
      // limit/offset — matching the Go `AlertRepository.FindAll`. Only the
      // caller's actor scope is filtered afterward, in memory, because it is
      // derived at request time and not a column the repository can push
      // into its own WHERE clause (same as the Go handler's `actorAllowed`).
      const page = await repos.alerts.findFiltered({ actorId, typeId, resolved, limit, offset });
      const visible = page.filter((a) => actorAllowed(scope, a.academicActorId));
      return reply.send({ alerts: visible });
    });

    app.get(`${base}/:id`, async (req, reply) => {
      const id = parseId((req.params as any).id);
      if (!id) return send400(reply, 'invalid id');
      const alert = await repos.alerts.findById(id);
      if (!alert) return notFound(reply);
      const scope = await scopeOf(req, reply);
      if (scope === undefined) return reply;
      if (!actorAllowed(scope, alert.academicActorId)) return forbidden(reply);
      return reply.send(alert);
    });

    app.patch(`${base}/:id/resolve`, async (req, reply) => {
      const id = parseId((req.params as any).id);
      if (!id) return send400(reply, 'invalid id');
      const current = await repos.alerts.findById(id);
      if (!current) return notFound(reply);
      const scope = await scopeOf(req, reply);
      if (scope === undefined) return reply;
      if (!actorAllowed(scope, current.academicActorId)) return forbidden(reply);
      const updated = await repos.alerts.update(id, { resolvedAt: new Date().toISOString() } as any);
      if (!updated) return notFound(reply);
      return reply.send(updated);
    });

    app.delete(`${base}/:id`, async (req, reply) => {
      const id = parseId((req.params as any).id);
      if (!id || !(await repos.alerts.softDelete(id))) return notFound(reply);
      return reply.code(204).send();
    });
  }

  registerAlertRoutes('/api/v1/alerts');
  registerAlertRoutes('/alerts');

  // ---------- Alert types ----------
  function registerAlertTypeRoutes(base: string) {
    app.post(base, async (req, reply) => {
      const parsed = createAlertTypeBody.safeParse((req as any).body);
      if (!parsed.success) return send400(reply, 'Invalid alert type payload', parsed.error.flatten());
      const created = await repos.alertTypes.create(parsed.data as any);
      return reply.code(201).send(created);
    });

    app.get(base, async (req, reply) => {
      const { limit, offset } = getLimitOffset(req);
      const list = await repos.alertTypes.list({ limit, offset });
      return reply.send({ alert_types: list });
    });

    app.get(`${base}/:id`, async (req, reply) => {
      const id = parseId((req.params as any).id);
      if (!id) return send400(reply, 'invalid id');
      const found = await repos.alertTypes.findById(id);
      if (!found) return notFound(reply);
      return reply.send(found);
    });

    app.put(`${base}/:id`, async (req, reply) => {
      const id = parseId((req.params as any).id);
      if (!id) return send400(reply, 'invalid id');
      const parsed = updateAlertTypeBody.safeParse((req as any).body);
      if (!parsed.success) return send400(reply, 'Invalid alert type payload', parsed.error.flatten());
      const updated = await repos.alertTypes.update(id, parsed.data as any);
      if (!updated) return notFound(reply);
      return reply.send(updated);
    });

    app.delete(`${base}/:id`, async (req, reply) => {
      const id = parseId((req.params as any).id);
      if (!id || !(await repos.alertTypes.softDelete(id))) return notFound(reply);
      return reply.code(204).send();
    });
  }

  registerAlertTypeRoutes('/api/v1/alert-types');
  registerAlertTypeRoutes('/alert-types');
}

const registerDeviceTokenBody = z.object({
  // Expo push token as returned by expo-notifications getExpoPushTokenAsync().
  token: z.string().max(255).regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'not an Expo push token'),
  platform: z.enum(DEVICE_PLATFORMS),
  locale: z.enum(DEVICE_LOCALES),
});

/**
 * Mobile push registration. Any signed-in user may register or revoke its own
 * devices: the actor always comes from the session (same lookup as the alert
 * scope), never from the body.
 */
export function registerDeviceTokenRoutes(app: FastifyInstance, tokens: IDeviceTokenRepository): void {
  function register(base: string) {
    app.post(base, async (req, reply) => {
      const parsed = registerDeviceTokenBody.safeParse((req as any).body);
      if (!parsed.success) return send400(reply, 'Invalid device token payload', parsed.error.flatten());
      const own = await resolveOrReply(reply, () => resolveOwnActorIds(req));
      if (own === undefined) return reply;
      if (own.length === 0) {
        return reply.code(403).send({ error: 'Forbidden', message: 'No academic actor for this user', timestamp: new Date().toISOString() });
      }
      // shortcut: a person with several actors gets pushes only for the lowest id; a token per actor needs a (token, actor) key.
      const actorId = Math.min(...own);
      const id = await tokens.upsert(actorId, parsed.data.token, parsed.data.platform, parsed.data.locale);
      return reply.code(201).send({ device_token_id: id });
    });

    app.delete(`${base}/:token`, async (req, reply) => {
      const token = String((req.params as any).token ?? '');
      if (!token || token.length > 255) return send400(reply, 'invalid token');
      const own = await resolveOrReply(reply, () => resolveOwnActorIds(req));
      if (own === undefined) return reply;
      // 204 even when the token is unknown or someone else's: idempotent, and it
      // does not reveal whether another user's token exists.
      await tokens.revokeOwned(token, own);
      return reply.code(204).send();
    });
  }

  register('/api/v1/device-tokens');
  register('/device-tokens');
}

const sendEmailBody = z.object({
  to: z.string().email(),
  template: z.string().min(1),
  data: z.record(z.string()).optional(),
});

/**
 * Internal email delivery route — ports `internal/infrastructure/http/handler/email_handler.go`.
 *
 * Registered separately from `registerNotificationRoutes` (from `main.ts`)
 * since it depends on the SMTP sender/config, not the alert repositories.
 * No `/emails` alias: unlike alerts/alert-types, spec §2.2 only defines
 * `/api/v1/emails` and Kong never exposes it outside the compose network.
 */
export function registerEmailRoute(app: FastifyInstance, cfg: SmtpConfig): void {
  app.post('/api/v1/emails', async (req, reply) => {
    if (cfg.internalToken) {
      const token = (req.headers as any)['x-internal-token'];
      if (token !== cfg.internalToken) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'missing or invalid internal token' });
      }
    }

    const parsed = sendEmailBody.safeParse((req as any).body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: parsed.error.message });
    }

    const { to, template, data } = parsed.data;
    if (!SUPPORTED_TEMPLATES.includes(template)) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'unsupported template' });
    }

    let body: { text: string; html: string };
    try {
      body = render(template, data ?? {});
    } catch (err) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: err instanceof Error ? err.message : String(err) });
    }

    try {
      const result = await sendEmail(cfg, {
        to,
        subject: subjectFor(template),
        textBody: body.text,
        htmlBody: body.html,
      });
      if (result === SMTP_NOT_CONFIGURED) {
        app.log.warn({ to, template }, 'email skipped, SMTP_HOST is empty');
        return reply.code(202).send({ status: 'skipped', reason: 'smtp_not_configured' });
      }
    } catch (err) {
      app.log.error({ err, to, template }, 'email delivery failed');
      return reply.code(502).send({ error: 'DELIVERY_FAILED', message: 'email delivery failed' });
    }

    return reply.code(202).send({ status: 'accepted' });
  });
}
