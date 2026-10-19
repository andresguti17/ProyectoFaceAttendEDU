jest.mock("../../services/api/authApi", () => ({
    authApi: {
        forgotPassword: jest.fn(),
        verifyCode: jest.fn(),
        resetPassword: jest.fn(),
    },
}));

import { act, create } from "react-test-renderer";
import React from "react";
import { authApi } from "../../services/api/authApi";
import { useRecoveryViewModel, RECOVERY_STEPS } from "../useRecoveryViewModel";

function renderHook() {
    let vm;
    function Probe() {
        vm = useRecoveryViewModel();
        return null;
    }
    act(() => {
        create(<Probe />);
    });
    return () => vm;
}

beforeEach(() => {
    jest.clearAllMocks();
});

test("advances email -> code -> password -> done", async () => {
    authApi.forgotPassword.mockResolvedValue({ status: "accepted" });
    authApi.verifyCode.mockResolvedValue({ status: "verified" });
    authApi.resetPassword.mockResolvedValue({ status: "updated" });
    const getVm = renderHook();

    await act(async () => {
        getVm().setEmail("ANA@uni.edu");
    });
    let ok;
    await act(async () => {
        ok = await getVm().sendCode();
    });
    expect(ok).toBe(true);
    expect(authApi.forgotPassword).toHaveBeenCalledWith("ana@uni.edu");
    expect(getVm().step).toBe(RECOVERY_STEPS.CODE);

    await act(async () => {
        getVm().setCode("123456");
    });
    await act(async () => {
        ok = await getVm().verifyCode();
    });
    expect(ok).toBe(true);
    expect(authApi.verifyCode).toHaveBeenCalledWith("ana@uni.edu", "123456");
    expect(getVm().step).toBe(RECOVERY_STEPS.PASSWORD);

    await act(async () => {
        getVm().setPassword("Secret123");
        getVm().setConfirm("Secret123");
    });
    await act(async () => {
        ok = await getVm().resetPassword();
    });
    expect(ok).toBe(true);
    expect(authApi.resetPassword).toHaveBeenCalledWith("ana@uni.edu", "Secret123");
    expect(getVm().step).toBe(RECOVERY_STEPS.DONE);
});

test("rejects invalid email, short code and mismatched passwords", async () => {
    const getVm = renderHook();

    await act(async () => {
        getVm().setEmail("no-es-correo");
    });
    let ok;
    await act(async () => {
        ok = await getVm().sendCode();
    });
    expect(ok).toBe(false);
    expect(authApi.forgotPassword).not.toHaveBeenCalled();
    expect(getVm().error).toBeTruthy();

    await act(async () => {
        getVm().setEmail("a@uni.edu");
        getVm().setPassword("Secret123");
        getVm().setConfirm("otra");
    });
    await act(async () => {
        ok = await getVm().resetPassword();
    });
    expect(ok).toBe(false);
    expect(authApi.resetPassword).not.toHaveBeenCalled();
});
