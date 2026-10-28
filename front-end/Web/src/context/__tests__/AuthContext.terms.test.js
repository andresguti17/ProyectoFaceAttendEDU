// Términos y condiciones en la web, igual que en la app móvil: el aviso aparece en el primer
// ingreso, la firma se registra una sola vez y en el ingreso posterior ya no se pide. Si no se
// puede verificar el estado, no se abre la sesión (antes se entraba sin ver el aviso).
import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../api/apiClient", () => ({
    getToken: jest.fn(),
    clearToken: jest.fn().mockResolvedValue(undefined),
    saveToken: jest.fn().mockResolvedValue(true),
    setUnauthorizedHandler: jest.fn(),
}));
jest.mock("../../core/hooks/useSessionTimeout", () => ({
    useSessionTimeout: () => ({ resetTimer: jest.fn(), isActive: false }),
}));
jest.mock("../../services/api/authApi", () => ({
    authApi: {
        login: jest.fn(),
        userRoles: jest.fn(),
        getUser: jest.fn(),
        getPerson: jest.fn(),
        schoolOf: jest.fn(),
        getSession: jest.fn(),
    },
}));
jest.mock("../../services/api/consentApi", () => ({
    consentApi: { get: jest.fn().mockResolvedValue({ accepted: true, upToDate: true }) },
}));
jest.mock("../../services/api/termsApi", () => ({ termsApi: { get: jest.fn(), accept: jest.fn() } }));

import { AuthProvider, useAuth } from "../AuthContext";
import { clearToken, getToken } from "../../api/apiClient";
import { authApi } from "../../services/api/authApi";
import { termsApi } from "../../services/api/termsApi";
import { TERMS_UNAVAILABLE } from "../../core/utils/termsGate";

const SESSION_KEY = "@faceattend:session_user";

function mount() {
    let auth;
    function Probe() {
        auth = useAuth();
        return null;
    }
    act(() => {
        create(
            <AuthProvider>
                <Probe />
            </AuthProvider>,
        );
    });
    return () => auth;
}

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

// identity con estado: sin firma pide los términos; después de firmar, la persona queda habilitada.
let signed;
function identityServer() {
    signed = false;
    termsApi.get.mockImplementation(async () =>
        signed
            ? { enabled: true, minor: false, pendingStep: "NONE" }
            : { enabled: false, minor: false, pendingStep: "TERMS" });
    termsApi.accept.mockImplementation(async () => {
        signed = true;
        return {};
    });
}

async function signIn(getAuth) {
    let result;
    await act(async () => {
        result = await getAuth().login({ email: "ana@sede.edu.co", password: "Secret-123" });
    });
    return result;
}

beforeEach(async () => {
    jest.clearAllMocks();
    sessionStorage.clear();
    getToken.mockResolvedValue(null);
    authApi.login.mockResolvedValue({ sessionId: "s-1", userId: "u-1" });
    authApi.userRoles.mockResolvedValue([{ roleName: "Aprendiz" }]);
    authApi.getUser.mockResolvedValue({ personId: "p-1", username: "ana" });
    authApi.getPerson.mockResolvedValue({ name: "Ana", lastName: "Ríos", email: "ana@sede.edu.co" });
    authApi.schoolOf.mockResolvedValue(null);
    identityServer();
});

test("first login shows the terms; after signing, a later login does not ask again", async () => {
    const getAuth = mount();
    await flush();

    // Primer ingreso: el aviso bloquea la entrada.
    expect(await signIn(getAuth)).toMatchObject({ success: true });
    expect(getAuth().user.termsGate).toBe("ACCEPT");

    // Firma una sola vez y entra.
    let error;
    await act(async () => {
        error = await getAuth().acceptTerms();
    });
    expect(error).toBeNull();
    expect(getAuth().user.termsGate).toBe("NONE");
    expect(termsApi.accept).toHaveBeenCalledTimes(1);

    // Ingreso posterior: identity ya tiene la firma, el aviso no vuelve a salir.
    expect(await signIn(getAuth)).toMatchObject({ success: true });
    expect(getAuth().user.termsGate).toBe("NONE");
    expect(termsApi.accept).toHaveBeenCalledTimes(1);
});

test("if the terms status cannot be verified, the session is not opened", async () => {
    termsApi.get.mockRejectedValue(new Error("503"));
    const getAuth = mount();
    await flush();

    expect(await signIn(getAuth)).toBe(TERMS_UNAVAILABLE);
    expect(getAuth().user).toBeNull();
    expect(clearToken).toHaveBeenCalled();
});

test("without a person to check, the session is not opened", async () => {
    authApi.getUser.mockResolvedValue({ username: "ana" });
    const getAuth = mount();
    await flush();

    expect(await signIn(getAuth)).toBe(TERMS_UNAVAILABLE);
    expect(getAuth().user).toBeNull();
});

test("a restored session re-checks the terms instead of trusting the stored state", async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: "u-1", personId: "p-1", role: "student", termsGate: "NONE" }));
    getToken.mockResolvedValue("s-1");
    authApi.getSession.mockResolvedValue({ sessionStatus: "Active" });

    const getAuth = mount();
    await flush();

    expect(getAuth().user.termsGate).toBe("ACCEPT");
});

test("a stored session that was never checked is dropped when identity does not answer", async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: "u-1", personId: "p-1", role: "student" }));
    getToken.mockResolvedValue("s-1");
    authApi.getSession.mockResolvedValue({ sessionStatus: "Active" });
    termsApi.get.mockRejectedValue(new Error("offline"));

    const getAuth = mount();
    await flush();

    expect(getAuth().user).toBeNull();
    expect(clearToken).toHaveBeenCalled();
});
