import { createHmac } from 'crypto';
import { notifyWebhook, webhookConfigFromEnv, WEBHOOK_NOT_CONFIGURED, type WebhookPayload } from '../notifier';

const payload: WebhookPayload = { alertId: 1, academicActorId: 2, alertTypeId: 3, alertTypeCode: 'X', severity: 'WARNING', channel: 'EMAIL', raisedAt: '2026-01-01T00:00:00.000Z' };

describe('notifyWebhook', () => {
  afterEach(() => {
    delete (global as any).fetch;
  });

  it('returns WEBHOOK_NOT_CONFIGURED when url is empty', async () => {
    expect(await notifyWebhook({ url: '', secret: '', timeoutMs: 1000 }, payload)).toBe(WEBHOOK_NOT_CONFIGURED);
  });

  it('signs the body with HMAC-SHA256 when a secret is set', async () => {
    const fetchMock = jest.fn(async (_url: string, init: any) => {
      expect(init.headers['X-Webhook-Signature']).toMatch(/^[0-9a-f]{64}$/);
      return { ok: true, status: 200 };
    });
    (global as any).fetch = fetchMock;
    await notifyWebhook({ url: 'http://x/hook', secret: 's3cret', timeoutMs: 1000 }, payload);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('sends the HMAC-SHA256 of the exact body, hex-encoded, matching Go', async () => {
    const fetchMock = jest.fn(async (_url: string, _init: any) => ({ ok: true, status: 200 }));
    (global as any).fetch = fetchMock;
    await notifyWebhook({ url: 'http://x/hook', secret: 's3cret', timeoutMs: 1000 }, payload);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, any];
    const expected = createHmac('sha256', 's3cret').update(init.body).digest('hex');
    expect(init.headers['X-Webhook-Signature']).toBe(expected);
  });

  it('omits the signature header when no secret is set', async () => {
    const fetchMock = jest.fn(async (_url: string, _init: any) => ({ ok: true, status: 200 }));
    (global as any).fetch = fetchMock;
    await notifyWebhook({ url: 'http://x/hook', secret: '', timeoutMs: 1000 }, payload);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, any];
    expect(init.headers['X-Webhook-Signature']).toBeUndefined();
  });

  it('throws when the receiver answers >= 300', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 500 }));
    await expect(notifyWebhook({ url: 'http://x/hook', secret: '', timeoutMs: 1000 }, payload)).rejects.toThrow();
  });
});

describe('webhookConfigFromEnv', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults timeoutMs to 5000', () => {
    delete process.env.WEBHOOK_TIMEOUT_SECONDS;
    expect(webhookConfigFromEnv().timeoutMs).toBe(5000);
  });

  it('converts WEBHOOK_TIMEOUT_SECONDS to milliseconds', () => {
    process.env.WEBHOOK_TIMEOUT_SECONDS = '7';
    expect(webhookConfigFromEnv().timeoutMs).toBe(7000);
  });

  it('falls back to 5000 for invalid or non-positive timeouts', () => {
    process.env.WEBHOOK_TIMEOUT_SECONDS = 'abc';
    expect(webhookConfigFromEnv().timeoutMs).toBe(5000);
    process.env.WEBHOOK_TIMEOUT_SECONDS = '0';
    expect(webhookConfigFromEnv().timeoutMs).toBe(5000);
  });
});
