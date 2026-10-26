import Fastify from 'fastify';
import { registerEmailRoute } from '../routes';
import * as sender from '../../email/sender';

describe('POST /api/v1/emails', () => {
  const cfg = { host: 'smtp.local', port: 587, from: 'a@b.c', username: '', password: '', startTls: false, timeoutMs: 1000, internalToken: 'secret' };
  const auth = { 'x-internal-token': 'secret' };

  it('rejects an unsupported template', async () => {
    const app = Fastify();
    registerEmailRoute(app, cfg);
    const res = await app.inject({ method: 'POST', url: '/api/v1/emails', headers: auth, payload: { to: 'x@y.com', template: 'other' } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a missing or wrong internal token', async () => {
    const app = Fastify();
    registerEmailRoute(app, cfg);
    const payload = { to: 'x@y.com', template: 'verification_code', data: { code: '1' } };
    expect((await app.inject({ method: 'POST', url: '/api/v1/emails', payload })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/emails', payload, headers: { 'x-internal-token': 'nope' } })).statusCode).toBe(403);
  });

  it('refuses every call while no internal token is configured (fail closed)', async () => {
    const send = jest.spyOn(sender, 'sendEmail');
    const app = Fastify();
    registerEmailRoute(app, { ...cfg, internalToken: '' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/emails', headers: { 'x-internal-token': '' }, payload: { to: 'x@y.com', template: 'verification_code', data: { code: '1' } } });
    expect(res.statusCode).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });

  it('responds 202 skipped when SMTP is not configured', async () => {
    jest.spyOn(sender, 'sendEmail').mockResolvedValue(sender.SMTP_NOT_CONFIGURED);
    const app = Fastify();
    registerEmailRoute(app, { ...cfg, host: '' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/emails', headers: auth, payload: { to: 'x@y.com', template: 'verification_code', data: { code: '123456' } } });
    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('skipped');
  });

  it('responds 502 when delivery fails', async () => {
    jest.spyOn(sender, 'sendEmail').mockRejectedValue(new Error('smtp down'));
    const app = Fastify();
    registerEmailRoute(app, cfg);
    const res = await app.inject({ method: 'POST', url: '/api/v1/emails', headers: auth, payload: { to: 'x@y.com', template: 'verification_code', data: { code: '123456' } } });
    expect(res.statusCode).toBe(502);
  });

  it("accepts the user_credentials template and sends the credentials with the fixed subject", async () => {
    const spy = jest.spyOn(sender, "sendEmail").mockResolvedValue(undefined as any);
    const app = Fastify();
    registerEmailRoute(app, cfg);
    const res = await app.inject({ method: "POST", url: "/api/v1/emails", headers: auth, payload: { to: "x@y.com", template: "user_credentials", data: { username: "ana", password: "Secret123!" } } });
    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe("accepted");
    const sent = spy.mock.calls[spy.mock.calls.length - 1][1] as any;
    expect(sent.subject).toBe("Tus credenciales de acceso - FaceAttend EDU");
    expect(sent.textBody).toContain("Secret123!");
  });

  it("returns 400 when user_credentials has no password", async () => {
    const app = Fastify();
    registerEmailRoute(app, cfg);
    const res = await app.inject({ method: "POST", url: "/api/v1/emails", headers: auth, payload: { to: "x@y.com", template: "user_credentials", data: { username: "ana" } } });
    expect(res.statusCode).toBe(400);
  });
});
