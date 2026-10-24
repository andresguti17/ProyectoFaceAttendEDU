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
jest.mock("../../services/api/authApi", () => ({ authApi: {} }));
jest.mock("../../services/api/consentApi", () => ({ consentApi: {} }));

import { AuthProvider, useAuth } from "../AuthContext";
import { getToken } from "../../api/apiClient";

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

test("startup session restore finishes loading with no user when reading the token fails", async () => {
    getToken.mockRejectedValue(new Error("storage unavailable"));
    const getAuth = mount();
    await flush();

    expect(getAuth().isLoadingAuth).toBe(false);
    expect(getAuth().user).toBeNull();
});

test("startup session restore finishes loading when there is no stored session", async () => {
    getToken.mockResolvedValue(null);
    const getAuth = mount();
    await flush();

    expect(getAuth().isLoadingAuth).toBe(false);
    expect(getAuth().user).toBeNull();
});
