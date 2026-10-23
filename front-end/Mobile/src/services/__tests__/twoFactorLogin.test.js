// Login con segundo factor: la contraseña correcta devuelve un reto (sin sesión) y el código
// del correo, enviado a /auth/login/verify, abre la sesión.
import { AuthService } from '../AuthService';

jest.mock('../../storage/TokenStorage', () => ({
  getToken: jest.fn(async () => 's-1'),
  saveToken: jest.fn(async () => true),
}));

function respond(routes) {
  global.fetch = jest.fn(async (url, options) => {
    const path = new URL(url).pathname;
    const handler = routes[`${options?.method ?? 'GET'} ${path}`];
    if (!handler) return { ok: false, status: 404, json: async () => ({}) };
    const { status = 200, body = {} } = handler;
    return { ok: status < 400, status, json: async () => body };
  });
}

const call = (needle) => global.fetch.mock.calls.find(([url]) => String(url).includes(needle));

describe('login con segundo factor', () => {
  test('una cuenta con 2FA recibe el reto y no se guarda ninguna sesión', async () => {
    respond({
      'POST /api/v1/auth/login': { body: { twoFactorRequired: true, maskedEmail: 'c***@example.com' } },
    });

    const result = await AuthService.login('carolina@example.com', 'Secret123');

    expect(result).toEqual({ twoFactorRequired: true, maskedEmail: 'c***@example.com' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('el código se envía con el mismo identificador y abre la sesión', async () => {
    respond({
      'POST /api/v1/auth/login/verify': { body: { sessionId: 's-1', userId: 'u-1' } },
      'GET /api/v1/users/u-1/roles': { body: [{ roleName: 'STUDENT' }] },
      'GET /api/v1/users/u-1': { body: { userId: 'u-1', personId: 'p-1', username: 'carolina' } },
      'GET /api/v1/persons/p-1': { body: { personId: 'p-1', name: 'Carolina', lastName: 'Mendoza', email: 'carolina@example.com' } },
      'GET /api/v1/auth/evaluate': { body: { allowed: true } },
    });

    const auth = await AuthService.verifyLoginCode(' carolina@example.com ', ' 123456 ');

    const [, options] = call('/auth/login/verify');
    expect(JSON.parse(options.body)).toEqual({ identifier: 'carolina@example.com', code: '123456' });
    expect(auth.token).toBe('s-1');
    expect(auth.user.roles).toEqual(['STUDENT']);
  });

  test('un código incorrecto se explica como código, no como credenciales', async () => {
    respond({ 'POST /api/v1/auth/login/verify': { status: 401, body: { error: 'UNAUTHORIZED' } } });

    await expect(AuthService.verifyLoginCode('carolina@example.com', '000000')).rejects.toMatchObject({ code: 'INVALID_CODE' });
  });
});
