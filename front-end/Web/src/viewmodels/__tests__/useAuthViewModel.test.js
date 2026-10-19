import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockLogin = jest.fn();

jest.mock("../../context/AuthContext", () => ({
    useAuth: () => ({ login: mockLogin }),
}));

jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));

import { useLoginViewModel } from "../useAuthViewModel";

function renderLogin(onSuccess) {
    let vm;
    function Probe() {
        vm = useLoginViewModel(onSuccess);
        return null;
    }
    act(() => {
        create(<Probe />);
    });
    return () => vm;
}

function fillValidCredentials(getVm) {
    act(() => {
        getVm().setEmail("admin@faceattend.edu");
    });
    act(() => {
        getVm().setPassword("Secret123!");
    });
}

describe("useLoginViewModel.handleLogin", () => {
    beforeEach(() => {
        mockLogin.mockReset();
    });

    it("resets loading and shows an error when login() throws instead of returning a string", async () => {
        mockLogin.mockRejectedValueOnce(new Error("boom"));
        const onSuccess = jest.fn();
        const getVm = renderLogin(onSuccess);
        fillValidCredentials(getVm);

        await act(async () => {
            await getVm().handleLogin();
        });

        const vm = getVm();
        expect(vm.loading).toBe(false);
        expect(vm.passwordError).toBe("boom");
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("shows backend string errors and calls onSuccess on null", async () => {
        jest.useFakeTimers();
        try {
            mockLogin.mockResolvedValueOnce("Credenciales incorrectas");
            const onSuccess = jest.fn();
            const getVm = renderLogin(onSuccess);
            fillValidCredentials(getVm);

            await act(async () => {
                await getVm().handleLogin();
            });

            let vm = getVm();
            expect(vm.loading).toBe(false);
            expect(vm.passwordError).toBe("Credenciales incorrectas");
            expect(onSuccess).not.toHaveBeenCalled();

            mockLogin.mockResolvedValueOnce(null);
            await act(async () => {
                await getVm().handleLogin();
            });
            act(() => {
                jest.advanceTimersByTime(250);
            });

            vm = getVm();
            expect(vm.loading).toBe(false);
            expect(onSuccess).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });
});
