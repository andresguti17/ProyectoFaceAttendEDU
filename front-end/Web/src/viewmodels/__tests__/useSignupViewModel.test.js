import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockOnboardSchool = jest.fn();

jest.mock("../../services/api/authApi", () => ({
    authApi: { onboardSchool: (...args) => mockOnboardSchool(...args) },
}));

jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));

import { useSignupViewModel } from "../useSignupViewModel";

function renderSignup(onSuccess) {
    let vm;
    function Probe() {
        vm = useSignupViewModel(onSuccess);
        return null;
    }
    act(() => {
        create(<Probe />);
    });
    return () => vm;
}

function fill(getVm, fields) {
    Object.entries(fields).forEach(([field, value]) => {
        act(() => {
            getVm().setValue(field, value);
        });
    });
}

const SCHOOL = { code: "cies-009", name: "Colegio Nuevo", cityName: "Bogotá" };
const ADMIN = {
    documentType: "CC",
    documentNumber: "123456",
    adminName: "Ana",
    adminLastName: "Pérez",
    adminEmail: "ana@colegio.edu",
    username: "ana.perez",
    password: "Str0ng!Passw0rd#",
    confirmPassword: "Str0ng!Passw0rd#",
};

async function submit(getVm) {
    await act(async () => {
        await getVm().handleRegister();
    });
}

describe("useSignupViewModel", () => {
    beforeEach(() => {
        mockOnboardSchool.mockReset();
    });

    it("normalizes the school code and the username while typing", () => {
        const getVm = renderSignup();
        fill(getVm, { code: "cies 009", username: "Ana Pérez" });
        expect(getVm().values.code).toBe("CIES009");
        expect(getVm().values.username).toBe("anaprez");
    });

    it("blocks step 1 until the school data is valid and shows its errors", () => {
        const getVm = renderSignup();
        act(() => {
            getVm().goNext();
        });
        expect(getVm().step).toBe(1);
        expect(Object.keys(getVm().errors).sort()).toEqual(["cityName", "code", "name"]);
    });

    it("moves to the administrator step once the school is valid and can go back", () => {
        const getVm = renderSignup();
        fill(getVm, SCHOOL);
        act(() => {
            getVm().goNext();
        });
        expect(getVm().step).toBe(2);
        act(() => {
            getVm().goBack();
        });
        expect(getVm().step).toBe(1);
    });

    it("does not call the API while the administrator data is invalid", async () => {
        const getVm = renderSignup();
        fill(getVm, SCHOOL);
        act(() => {
            getVm().goNext();
        });
        await submit(getVm);
        expect(mockOnboardSchool).not.toHaveBeenCalled();
        expect(getVm().errors.documentType).toBeDefined();
    });

    it("sends school and admin together and exposes the pending result", async () => {
        mockOnboardSchool.mockResolvedValue({ schoolId: 7, userId: "u-1", status: "PENDING_ACTIVATION" });
        const onSuccess = jest.fn();
        const getVm = renderSignup(onSuccess);
        fill(getVm, SCHOOL);
        act(() => {
            getVm().goNext();
        });
        fill(getVm, ADMIN);
        await submit(getVm);

        expect(mockOnboardSchool).toHaveBeenCalledTimes(1);
        const body = mockOnboardSchool.mock.calls[0][0];
        expect(body.school).toMatchObject({ code: "CIES-009", name: "Colegio Nuevo", cityName: "Bogotá" });
        expect(body.admin).toMatchObject({ documentType: "CC", username: "ana.perez", email: "ana@colegio.edu" });
        expect(getVm().done).toMatchObject({ status: "PENDING_ACTIVATION" });
        expect(onSuccess).toHaveBeenCalledWith({ email: "ana@colegio.edu", username: "ana.perez" });
        expect(getVm().loading).toBe(false);
    });

    it("returns to step 1 and flags the code when the school code already exists", async () => {
        mockOnboardSchool.mockRejectedValue({ status: 409, message: "School already exists with value=CIES-009" });
        const getVm = renderSignup();
        fill(getVm, SCHOOL);
        act(() => {
            getVm().goNext();
        });
        fill(getVm, ADMIN);
        await submit(getVm);

        expect(getVm().step).toBe(1);
        expect(getVm().errors.code).toBeDefined();
        expect(getVm().done).toBeNull();
    });

    it("shows a general message when the service is unavailable", async () => {
        mockOnboardSchool.mockRejectedValue({ status: 503, message: "x" });
        const getVm = renderSignup();
        fill(getVm, SCHOOL);
        act(() => {
            getVm().goNext();
        });
        fill(getVm, ADMIN);
        await submit(getVm);

        expect(getVm().step).toBe(2);
        expect(getVm().submitError).toMatch(/no está disponible/);
    });
});
