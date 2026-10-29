// S-10: por defecto la web no guarda ni envía el id de sesión; EXPO_PUBLIC_SESSION_MODE=bearer lo apaga.
import { getToken, isCookieMode, request, saveToken } from '../apiClient';

const okResponse = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

beforeEach(() => {
    global.sessionStorage.clear();
    global.fetch = jest.fn(async () => okResponse({}));
});

afterEach(() => {
    delete process.env.EXPO_PUBLIC_SESSION_MODE;
});

describe('modo bearer (EXPO_PUBLIC_SESSION_MODE=bearer)', () => {
    beforeEach(() => {
        process.env.EXPO_PUBLIC_SESSION_MODE = 'bearer';
    });

    it('no está en modo cookie y manda Authorization sin credentials', async () => {
        await saveToken('11111111-2222-3333-4444-555555555555');
        expect(isCookieMode()).toBe(false);
        await request('/api/v1/schools');
        const [, init] = global.fetch.mock.calls[0];
        expect(init.headers.Authorization).toBe('Bearer 11111111-2222-3333-4444-555555555555');
        expect(init.credentials).toBeUndefined();
        expect(init.headers['X-Session-Mode']).toBeUndefined();
    });
});

describe('modo cookie (por defecto)', () => {
    it('está activo sin configurar nada, o con cookie', () => {
        expect(isCookieMode()).toBe(true);
        process.env.EXPO_PUBLIC_SESSION_MODE = 'cookie';
        expect(isCookieMode()).toBe(true);
        process.env.EXPO_PUBLIC_SESSION_MODE = 'bearer';
        expect(isCookieMode()).toBe(false);
    });

    it('no guarda el id de sesión: solo una marca', async () => {
        await saveToken('11111111-2222-3333-4444-555555555555', { email: 'a@b.co' });
        const raw = global.sessionStorage.getItem('auth_token');
        expect(raw).not.toContain('11111111');
        expect(await getToken()).toBe('cookie-session');
    });

    it('manda cookie, X-Requested-With y X-Session-Mode, y nunca Authorization', async () => {
        await saveToken('cualquiera');
        await request('/api/v1/schools', { headers: { Authorization: 'Bearer pirata' } });
        const [, init] = global.fetch.mock.calls[0];
        expect(init.credentials).toBe('include');
        expect(init.headers['X-Requested-With']).toBe('FaceAttend');
        expect(init.headers['X-Session-Mode']).toBe('cookie');
        expect(init.headers.Authorization).toBeUndefined();
    });

    it('también lo manda sin marca guardada (login)', async () => {
        await request('/api/v1/auth/login', { method: 'POST', body: { identifier: 'a', password: 'b' } });
        const [, init] = global.fetch.mock.calls[0];
        expect(init.credentials).toBe('include');
        expect(init.headers['X-Session-Mode']).toBe('cookie');
    });
});
