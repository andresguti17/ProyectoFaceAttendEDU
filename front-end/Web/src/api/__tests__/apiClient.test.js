import {
    ApiError,
    getToken,
    saveToken,
    clearToken,
    setUnauthorizedHandler,
    request,
} from '../apiClient';

beforeEach(() => {
    global.localStorage.clear();
    global.fetch = jest.fn();
    setUnauthorizedHandler(null);
});

describe('token storage (web branch: localStorage)', () => {
    it('returns null when there is no saved session', async () => {
        expect(await getToken()).toBeNull();
    });

    it('round-trips a saved token', async () => {
        await saveToken('abc123', { email: 'a@b.com' });
        expect(await getToken()).toBe('abc123');
    });

    it('treats an expired token as absent and clears it', async () => {
        await saveToken('abc123', { expiresAt: Date.now() - 1000 });
        expect(await getToken()).toBeNull();
        expect(await getToken()).toBeNull(); // stayed cleared, not just this call
    });

    it('clearToken removes the saved session', async () => {
        await saveToken('abc123');
        await clearToken();
        expect(await getToken()).toBeNull();
    });

    it('rejects a non-string token', async () => {
        expect(await saveToken(null)).toBe(false);
        expect(await saveToken(42)).toBe(false);
    });
});

describe('request()', () => {
    function okResponse(body, status = 200) {
        return {
            ok: true,
            status,
            text: async () => JSON.stringify(body),
        };
    }

    function errorResponse(status, body) {
        return {
            ok: false,
            status,
            text: async () => JSON.stringify(body),
        };
    }

    it('sends a Bearer header when a token is saved', async () => {
        await saveToken('my-token');
        global.fetch.mockResolvedValueOnce(okResponse({ ok: true }));

        await request('/api/v1/ping');

        const [, init] = global.fetch.mock.calls[0];
        expect(init.headers.Authorization).toBe('Bearer my-token');
    });

    it('omits the Authorization header when there is no session', async () => {
        global.fetch.mockResolvedValueOnce(okResponse({ ok: true }));

        await request('/api/v1/ping');

        const [, init] = global.fetch.mock.calls[0];
        expect(init.headers.Authorization).toBeUndefined();
    });

    it('unwraps a { data, meta } page envelope by default', async () => {
        global.fetch.mockResolvedValueOnce(
            okResponse({ data: [1, 2, 3], meta: { total: 3 } })
        );

        const result = await request('/api/v1/users');
        expect(result).toEqual([1, 2, 3]);
    });

    it('keeps the raw payload when unwrap is false', async () => {
        const payload = { data: [1], meta: { total: 1 } };
        global.fetch.mockResolvedValueOnce(okResponse(payload));

        const result = await request('/api/v1/users', { unwrap: false });
        expect(result).toEqual(payload);
    });

    it('throws a typed ApiError built from the FastAPI {detail} shape', async () => {
        global.fetch.mockResolvedValueOnce(
            errorResponse(422, { detail: [{ loc: ['body', 'email'], msg: 'invalid' }] })
        );

        await expect(request('/api/v1/users', { method: 'POST', body: {} })).rejects.toMatchObject({
            name: 'ApiError',
            status: 422,
            message: 'body.email: invalid',
        });
    });

    it('calls the unauthorized handler on a 401 from a non-auth path', async () => {
        const onUnauthorized = jest.fn();
        setUnauthorizedHandler(onUnauthorized);
        global.fetch.mockResolvedValueOnce(errorResponse(401, { message: 'Session expired' }));

        await expect(request('/api/v1/users')).rejects.toBeInstanceOf(ApiError);
        expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('does NOT call the unauthorized handler on a 401 from an auth (credential) path', async () => {
        const onUnauthorized = jest.fn();
        setUnauthorizedHandler(onUnauthorized);
        global.fetch.mockResolvedValueOnce(errorResponse(401, { message: 'Wrong password' }));

        await expect(request('/api/v1/auth/login', { method: 'POST', body: {} })).rejects.toBeInstanceOf(
            ApiError
        );
        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('does NOT call the unauthorized handler on a business 401 (e.g. face not recognized)', async () => {
        const onUnauthorized = jest.fn();
        setUnauthorizedHandler(onUnauthorized);
        global.fetch.mockResolvedValueOnce(errorResponse(401, { detail: 'Face not recognized' }));

        await expect(
            request('/api/v1/face-auth/login', { businessUnauthorized: true })
        ).rejects.toBeInstanceOf(ApiError);
        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('retries a GET once on a network failure, then succeeds', async () => {
        global.fetch
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(okResponse({ ok: true }));

        const result = await request('/api/v1/ping');
        expect(result).toEqual({ ok: true });
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry a POST on network failure', async () => {
        global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        await expect(request('/api/v1/users', { method: 'POST', body: {} })).rejects.toMatchObject({
            code: 'NetworkError',
        });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry when retryOnceOnNetworkError is explicitly false', async () => {
        global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        await expect(
            request('/api/v1/ping', { retryOnceOnNetworkError: false })
        ).rejects.toMatchObject({ code: 'NetworkError' });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
