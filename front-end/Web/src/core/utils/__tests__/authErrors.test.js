import { loginErrorMessage, loginCodeErrorMessage, LOGIN_MESSAGES } from "../authErrors";

describe("loginErrorMessage", () => {
    it("maps wrong credentials (400/401) to the credentials message", () => {
        expect(loginErrorMessage({ status: 401, message: "Unauthorized" })).toBe(LOGIN_MESSAGES.invalidCredentials);
        expect(loginErrorMessage({ status: 400 })).toBe(LOGIN_MESSAGES.invalidCredentials);
    });

    it("maps a locked account and rate limiting", () => {
        expect(loginErrorMessage({ status: 423 })).toBe(LOGIN_MESSAGES.locked);
        expect(loginErrorMessage({ status: 429 })).toBe(LOGIN_MESSAGES.tooManyRequests);
    });

    it("never shows the raw gateway text for server errors", () => {
        for (const status of [500, 502, 503, 504]) {
            const msg = loginErrorMessage({ status, message: "An invalid response was received from the upstream server" });
            expect(msg).toBe(LOGIN_MESSAGES.serverUnavailable);
            expect(msg).not.toMatch(/upstream/i);
        }
    });

    it("keeps the network/timeout message of the client", () => {
        expect(loginErrorMessage({ status: 0, message: "Tiempo de espera agotado" })).toBe("Tiempo de espera agotado");
        expect(loginErrorMessage({ status: 0 })).toBe(LOGIN_MESSAGES.serverUnavailable);
    });

    it("falls back to the error message or a generic one", () => {
        expect(loginErrorMessage({ status: 418, message: "Soy una tetera" })).toBe("Soy una tetera");
        expect(loginErrorMessage(undefined)).toBe(LOGIN_MESSAGES.generic);
    });
});

describe("second factor messages", () => {
    it("tells the person the e-mailed code could not be sent instead of a generic outage", () => {
        const msg = loginErrorMessage({ status: 503, message: "The verification code could not be sent" });
        expect(msg).toBe(LOGIN_MESSAGES.codeNotSent);
    });

    it("treats a 401 while typing the code as a wrong code, not wrong credentials", () => {
        expect(loginCodeErrorMessage({ status: 401 })).toBe(LOGIN_MESSAGES.invalidCode);
        expect(loginCodeErrorMessage({ status: 400 })).toBe(LOGIN_MESSAGES.invalidCode);
    });

    it("keeps the lock and outage messages for the code step", () => {
        expect(loginCodeErrorMessage({ status: 423 })).toBe(LOGIN_MESSAGES.locked);
        expect(loginCodeErrorMessage({ status: 502 })).toBe(LOGIN_MESSAGES.serverUnavailable);
    });
});
