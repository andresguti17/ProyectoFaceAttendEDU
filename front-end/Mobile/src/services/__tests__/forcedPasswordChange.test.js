// Cuenta con contraseña inicial (p. ej. el admin creado con bootstrap-admin.sh): la sesión
// llega con mustChangePassword y la app debe exigir el cambio antes de entrar.
import { AuthService } from '../AuthService';

jest.mock('../../storage/TokenStorage', () => ({
  getToken: jest.fn(async () => 's-1'),
  saveToken: jest.fn(async () => true),
}));

function respond(session) {
  const routes = {
    'POST /api/v1/auth/login': session,
    'GET /api/v1/users/u-1/roles': [{ roleName: 'ADMIN' }],
    'GET /api/v1/users/u-1': { userId: 'u-1', personId: 'p-1', username: 'admin.sede' },
    'GET /api/v1/persons/p-1': { personId: 'p-1', name: 'Admin', lastName: 'Sede', email: 'admin@sede.edu.co' },
    'GET /api/v1/auth/evaluate': { allowed: true },
  };
  global.fetch = jest.fn(async (url, options) => {
    const body = routes[`${options?.method ?? 'GET'} ${new URL(url).pathname}`];
    if (!body) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  });
}

describe('cambio de contraseña obligatorio', () => {
  test('la sesión con contraseña inicial marca mustChangePassword', async () => {
    respond({ sessionId: 's-1', userId: 'u-1', mustChangePassword: true });
    const auth = await AuthService.login('admin@sede.edu.co', 'Initial-Secret-1');
    expect(auth.mustChangePassword).toBe(true);
  });

  test('una sesión normal no pide el cambio', async () => {
    respond({ sessionId: 's-1', userId: 'u-1', mustChangePassword: false });
    const auth = await AuthService.login('admin@sede.edu.co', 'Initial-Secret-1');
    expect(auth.mustChangePassword).toBe(false);
  });
});
