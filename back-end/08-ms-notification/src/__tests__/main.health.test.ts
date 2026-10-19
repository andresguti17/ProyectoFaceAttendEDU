import { app } from '../main';

describe('GET /health', () => {
  it('answers 200 with the service name', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().service).toBe('notification-service');
  });
});
