import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockChangePassword = jest.fn();

jest.mock("../../context/AuthContext", () => ({
    useAuth: () => ({
        user: { username: "ana.perez", email: "ana@colegio.edu" },
        changePassword: (...args) => mockChangePassword(...args),
    }),
}));

jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));

import { useChangePasswordViewModel } from "../useChangePasswordViewModel";

function renderVm() {
    let vm;
    function Probe() {
        vm = useChangePasswordViewModel();
        return null;
    }
    act(() => {
        create(<Probe />);
    });
    return () => vm;
}

function fill(getVm, { current = "Old1234!", next = "Str0ng!Passw0rd#", confirm = next } = {}) {
    act(() => getVm().setCurrent(current));
    act(() => getVm().setNew(next));
    act(() => getVm().setConfirm(confirm));
}

async function submit(getVm) {
    let ok;
    await act(async () => {
        ok = await getVm().submit();
    });
    return ok;
}

describe("useChangePasswordViewModel", () => {
    beforeEach(() => {
        mockChangePassword.mockReset();
    });

    it("rejects an empty form without calling the backend", async () => {
        const getVm = renderVm();
        expect(await submit(getVm)).toBe(false);
        expect(Object.keys(getVm().errors).sort()).toEqual(["confirmPassword", "currentPassword", "newPassword"]);
        expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it("requires the new password to differ from the current one", async () => {
        const getVm = renderVm();
        fill(getVm, { current: "Str0ng!Passw0rd#", next: "Str0ng!Passw0rd#" });
        expect(await submit(getVm)).toBe(false);
        expect(getVm().errors.newPassword).toMatch(/distinta/);
    });

    it("rejects a weak new password and a mismatched confirmation", async () => {
        const getVm = renderVm();
        fill(getVm, { next: "abc", confirm: "abc" });
        await submit(getVm);
        expect(getVm().errors.newPassword).toBeDefined();

        fill(getVm, { confirm: "otra" });
        await submit(getVm);
        expect(getVm().errors.confirmPassword).toMatch(/no coinciden/);
        expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it("sends current and new password and reports success", async () => {
        mockChangePassword.mockResolvedValue(null);
        const getVm = renderVm();
        fill(getVm);

        expect(await submit(getVm)).toBe(true);
        expect(mockChangePassword).toHaveBeenCalledWith("Old1234!", "Str0ng!Passw0rd#");
        expect(getVm().loading).toBe(false);
    });

    it("shows a wrong current password next to its field", async () => {
        mockChangePassword.mockResolvedValue("La contraseña actual no es correcta");
        const getVm = renderVm();
        fill(getVm);

        expect(await submit(getVm)).toBe(false);
        expect(getVm().errors.currentPassword).toMatch(/actual no es correcta/);
        expect(getVm().submitError).toBe("");
    });

    it("shows other failures as a general message", async () => {
        mockChangePassword.mockResolvedValue("No se pudo cambiar la contraseña");
        const getVm = renderVm();
        fill(getVm);

        expect(await submit(getVm)).toBe(false);
        expect(getVm().submitError).toBe("No se pudo cambiar la contraseña");
    });
});
