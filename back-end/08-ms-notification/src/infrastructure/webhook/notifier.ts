import { createHmac } from 'crypto';

// Port of back-end/08-ms-notification/internal/infrastructure/webhook/{notifier,config}.go.

export interface WebhookPayload {
  alertId: number;
  academicActorId: number;
  alertTypeId: number;
  alertTypeCode: string;
  severity: string;
  channel: string;
  raisedAt: string;
}

export interface WebhookConfig {
  url: string;
  secret: string;
  timeoutMs: number;
}

export const WEBHOOK_NOT_CONFIGURED = Symbol('webhook-not-configured');

const DEFAULT_TIMEOUT_SECONDS = 5;

export function webhookConfigFromEnv(): WebhookConfig {
  const rawTimeout = (process.env.WEBHOOK_TIMEOUT_SECONDS ?? '').trim();
  const parsed = Number.parseInt(rawTimeout, 10);
  const seconds = rawTimeout !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_SECONDS;
  return {
    url: (process.env.WEBHOOK_URL ?? '').trim(),
    secret: process.env.WEBHOOK_SECRET ?? '',
    timeoutMs: seconds * 1000,
  };
}

// Wire body keeps the snake_case keys of the Go Payload struct.
function toWireBody(p: WebhookPayload): string {
  return JSON.stringify({
    alert_id: p.alertId,
    academic_actor_id: p.academicActorId,
    alert_type_id: p.alertTypeId,
    alert_type_code: p.alertTypeCode,
    severity: p.severity,
    channel: p.channel,
    raised_at: p.raisedAt,
  });
}

export async function notifyWebhook(
  cfg: WebhookConfig,
  payload: WebhookPayload,
): Promise<void | typeof WEBHOOK_NOT_CONFIGURED> {
  if (cfg.url === '') {
    return WEBHOOK_NOT_CONFIGURED;
  }

  const body = toWireBody(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.secret !== '') {
    headers['X-Webhook-Signature'] = createHmac('sha256', cfg.secret).update(body).digest('hex');
  }

  const res = await fetch(cfg.url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });

  if (res.status >= 300) {
    throw new Error(`webhook: receiver responded with status ${res.status}`);
  }
}
