// La sesión se renueva antes de vencer para que quien sigue usando la app no vuelva al login.
import { request, refreshSession, GET, POST, SESSION_REFRESH_AFTER_MS, onSessionExpired } from '../apiClient';
import { saveToken } from '../../storage/TokenStorage';
import { AuthService } from '../../services/AuthService';

let mockStore = null;

jest.mock('../../storage/TokenStorage', () => ({
  getToken: jest.fn(async () => mockStore?.token ?? null),
  getSession: jest.fn(async () => mockStore),
  saveToken: jest.fn(async (token, email) => {
    mockStore = { token, savedAt: Date.now(), expiresAt: null, email };
    return true;
  }),
}));

const REFRESH_URL = 'http://gateway.test:8080/api/v1/auth/refresh';

function ok(body) {
  return { ok: true, status: 200, json: async () => body };
}

function authHeaderOf(urlPart) {
  const call = global.fetch.mock.calls.find(([url]) => url.includes(urlPart));
  return call?.[1].headers.Authorization;
}

function refreshCalls() {
  return global.fetch.mock.calls.filter(([url]) => url === REFRESH_URL);
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async (url) => (url === REFRESH_URL ? ok({ sessionId: 'new-session' }) : ok([])));
});

test('una sesión reciente se usa tal cual, sin renovar', async () => {
  mockStore = { token: 'old-session', savedAt: Date.now() - 5 * 60 * 1000, email: 'ana@example.com' };

  await request({ method: GET, url: 'api/v1/courses' });

  expect(refreshCalls()).toHaveLength(0);
  expect(authHeaderOf('/api/v1/courses')).toBe('Bearer old-session');
});

test('una sesión de más de una hora se renueva antes de la petición y se guarda la nueva', async () => {
  mockStore = { token: 'old-session', savedAt: Date.now() - SESSION_REFRESH_AFTER_MS - 1000, email: 'ana@example.com' };

  await request({ method: GET, url: 'api/v1/courses' });

  expect(refreshCalls()).toHaveLength(1);
  expect(JSON.parse(refreshCalls()[0][1].body)).toEqual({ sessionId: 'old-session' });
  expect(saveToken).toHaveBeenCalledWith('new-session', 'ana@example.com');
  expect(authHeaderOf('/api/v1/courses')).toBe('Bearer new-session');
});

test('varias peticiones a la vez comparten una sola renovación', async () => {
  mockStore = { token: 'old-session', savedAt: Date.now() - SESSION_REFRESH_AFTER_MS - 1000, email: null };

  await Promise.all([
    request({ method: GET, url: 'api/v1/courses' }),
    request({ method: GET, url: 'api/v1/programs' }),
    request({ method: POST, url: 'api/v1/justifications', data: { reason: 'x' } }),
  ]);

  expect(refreshCalls()).toHaveLength(1);
  expect(authHeaderOf('/api/v1/courses')).toBe('Bearer new-session');
  expect(authHeaderOf('/api/v1/programs')).toBe('Bearer new-session');
  expect(authHeaderOf('/api/v1/justifications')).toBe('Bearer new-session');
});

test('si la renovación falla se sigue con la sesión actual y no se cierra la sesión por ese fallo', async () => {
  const expired = jest.fn();
  const off = onSessionExpired(expired);
  mockStore = { token: 'old-session', savedAt: Date.now() - SESSION_REFRESH_AFTER_MS - 1000, email: null };
  global.fetch = jest.fn(async (url) => (url === REFRESH_URL
    ? { ok: false, status: 401, json: async () => ({ message: 'Session already refreshed' }) }
    : ok([])));

  await expect(request({ method: GET, url: 'api/v1/courses' })).resolves.toEqual([]);

  expect(saveToken).not.toHaveBeenCalled();
  expect(authHeaderOf('/api/v1/courses')).toBe('Bearer old-session');
  expect(expired).not.toHaveBeenCalled();
  off();
});

test('los flujos de credenciales nunca disparan la renovación', async () => {
  mockStore = { token: 'old-session', savedAt: Date.now() - SESSION_REFRESH_AFTER_MS - 1000, email: null };

  await request({ method: POST, url: 'api/v1/auth/login', data: {}, requiresAuth: false });

  expect(refreshCalls()).toHaveLength(0);
});

test('AuthService.refreshToken rota la sesión y devuelve el sessionId nuevo', async () => {
  mockStore = { token: 'old-session', savedAt: Date.now(), email: 'ana@example.com' };

  await expect(AuthService.refreshToken()).resolves.toBe('new-session');
  await expect(refreshSession()).resolves.toBe('new-session');
  expect(refreshCalls()).toHaveLength(2);
});
