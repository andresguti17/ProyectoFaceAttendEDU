// El id de sesión es un bearer: viaja en la cabecera Authorization, nunca en la URL (que queda en los logs).
jest.mock("../../../api/apiClient", () => ({ request: jest.fn(async () => ({})), isCookieMode: jest.fn(() => false) }));

import { isCookieMode, request } from "../../../api/apiClient";
import { authApi } from "../authApi";

beforeEach(() => {
    request.mockClear();
    isCookieMode.mockReturnValue(false);
});

test("logout sends the session as a bearer and nothing in the query string", async () => {
    await authApi.logout("11111111-2222-3333-4444-555555555555");

    const [url, opts] = request.mock.calls[0];
    expect(url).toContain("/auth/logout");
    expect(opts).toEqual({ method: "POST", headers: { Authorization: "Bearer 11111111-2222-3333-4444-555555555555" } });
    expect(opts.query).toBeUndefined();
});

test("in cookie mode logout sends no Authorization header (the browser sends the cookie)", async () => {
    isCookieMode.mockReturnValue(true);
    await authApi.logout("cookie-session");

    const [url, opts] = request.mock.calls[0];
    expect(url).toContain("/auth/logout");
    expect(opts).toEqual({ method: "POST" });
});
