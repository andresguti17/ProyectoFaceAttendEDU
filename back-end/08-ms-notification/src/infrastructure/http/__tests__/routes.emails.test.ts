import Fastify from 'fastify';
import { registerEmailRoute } from '../routes';
import * as sender from '../../email/sender';

describe('POST /api/v1/emails', () => {
  const cfg = { host: 'smtp.local', port: 587, from: 'a@b.c', username: '', password: '', startTls: false, timeoutMs: 1000, internalToken: '' };

  it('rejects an unsupported template', async () => {
    const app = Fastify();
    registerEmailRoute(app, cfg);
    const res = await app.inject({ method: 'POST', url: '/api/v1/emails', payload: { to: 'x@y.com', template: 'other' } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a missing/invalid internal token when one is configured', async () => {
    const app = Fastify();
    registerEmailRoute(app, { ...cfg, internalToken: 'secret' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/emails', payload: { to: 'x@y.com', template: 'verification_code', data: { code: '1' } } });
    expect(res.statusCode).toBe(403);
  });

  it('responds 202 skipped when SMTP is not configured', async () => {
    jest.spyOn(sender, 'sendEmail').mockResolvedValue(sender.SMTP_NOT_CONFIGURED);
    const app = Fastify();
    registerEmailRoute(app, { ...cfg, host: '' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/emails', payload: { to: 'x@y.com', template: 'verification_code', data: { code: '123456' } } });
    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('skipped');
  });

  it('responds 502 when delivery fails', async () => {
    jest.spyOn(sender, 'sendEmail').mockRejectedValue(new Error('smtp down'));
    const app = Fastify();
    registerEmailRoute(app, cfg);
    const res = await app.inject({ method: 'POST', url: '/api/v1/emails', payload: { to: 'x@y.com', template: 'verification_code', data: { code: '123456' } } });
    expect(res.statusCode).toBe(502);
  });
});
