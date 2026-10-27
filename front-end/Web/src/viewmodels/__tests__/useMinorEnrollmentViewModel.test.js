// El administrador registra al acudiente del menor, vincula y registra la aceptación de los términos.
import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../services/api/termsApi", () => ({
    termsApi: { get: jest.fn(), accept: jest.fn() },
    guardianApi: { get: jest.fn(), register: jest.fn(), update: jest.fn() },
}));
jest.mock("../../services/api/consentApi", () => ({ consentApi: { accept: jest.fn() } }));

import { termsApi, guardianApi } from "../../services/api/termsApi";
import { consentApi } from "../../services/api/consentApi";
import { useMinorEnrollmentViewModel, validateGuardian } from "../useMinorEnrollmentViewModel";

const GUARDIAN_PENDING = { enabled: false, minor: true, guardianRegistered: false, termsUpToDate: false, pendingStep: "GUARDIAN" };
const TERMS_PENDING = { enabled: false, minor: true, guardianRegistered: true, termsUpToDate: false, pendingStep: "TERMS" };
const ENABLED = { enabled: true, minor: true, guardianRegistered: true, termsUpToDate: true, pendingStep: "NONE" };
const NOT_FOUND = Object.assign(new Error("not found"), { status: 404 });

const FORM = {
    fullName: "Ana Gómez",
    documentType: "CC",
    documentNumber: "5005",
    email: "ana@correo.co",
    phone: "",
    relationship: "Madre",
};

async function renderVm(personId = "minor-1") {
    let vm;
    function Probe() {
        vm = useMinorEnrollmentViewModel(personId);
        return null;
    }
    await act(async () => {
        create(<Probe />);
    });
    return () => vm;
}

beforeEach(() => jest.clearAllMocks());

test("a minor without a guardian starts on the guardian step", async () => {
    termsApi.get.mockResolvedValue(GUARDIAN_PENDING);
    guardianApi.get.mockRejectedValue(NOT_FOUND);

    const vm = await renderVm();

    expect(vm().guardian).toBeNull();
    expect(vm().guardianRegistered).toBe(false);
    expect(vm().enabled).toBe(false);
    expect(vm().error).toBeNull();
});

test("registering the guardian links them and moves the minor to the terms step", async () => {
    termsApi.get.mockResolvedValueOnce(GUARDIAN_PENDING).mockResolvedValueOnce(TERMS_PENDING);
    guardianApi.get.mockRejectedValue(NOT_FOUND);
    guardianApi.register.mockResolvedValue({ guardianId: "g-1", ...FORM });
    const vm = await renderVm();

    Object.entries(FORM).forEach(([key, value]) => act(() => vm().setField(key, value)));
    let result;
    await act(async () => {
        result = await vm().saveGuardian();
    });

    expect(result).toBeNull();
    expect(guardianApi.register).toHaveBeenCalledWith("minor-1", expect.objectContaining({ documentNumber: "5005" }));
    expect(guardianApi.update).not.toHaveBeenCalled();
    expect(vm().guardianRegistered).toBe(true);
    expect(vm().termsAccepted).toBe(false);
});

test("an invalid guardian is refused before calling the server", async () => {
    termsApi.get.mockResolvedValue(GUARDIAN_PENDING);
    guardianApi.get.mockRejectedValue(NOT_FOUND);
    const vm = await renderVm();

    let result;
    await act(async () => {
        result = await vm().saveGuardian();
    });

    expect(result).toMatch(/nombre completo/);
    expect(guardianApi.register).not.toHaveBeenCalled();
});

test("an existing guardian is edited, not registered again", async () => {
    termsApi.get.mockResolvedValue(TERMS_PENDING);
    guardianApi.get.mockResolvedValue({ guardianId: "g-1", ...FORM });
    guardianApi.update.mockResolvedValue({ guardianId: "g-1", ...FORM, phone: "3001234567" });
    const vm = await renderVm();
    expect(vm().form.fullName).toBe("Ana Gómez");

    await act(async () => {
        await vm().saveGuardian();
    });

    expect(guardianApi.update).toHaveBeenCalledTimes(1);
    expect(guardianApi.register).not.toHaveBeenCalled();
});

test("the terms are recorded for the guardian together with the data authorization, and the minor is enabled", async () => {
    termsApi.get.mockResolvedValueOnce(TERMS_PENDING).mockResolvedValueOnce(ENABLED);
    guardianApi.get.mockResolvedValue({ guardianId: "g-1", ...FORM });
    termsApi.accept.mockResolvedValue(ENABLED);
    consentApi.accept.mockResolvedValue({});
    const vm = await renderVm();

    let result;
    await act(async () => {
        result = await vm().recordTerms({ biometricAccepted: true });
    });

    expect(result).toBeNull();
    expect(termsApi.accept).toHaveBeenCalledWith("minor-1");
    expect(consentApi.accept).toHaveBeenCalledWith("minor-1", { biometricAccepted: true });
    expect(vm().enabled).toBe(true);
    expect(vm().termsAccepted).toBe(true);
});

test("the terms cannot be recorded before the guardian exists", async () => {
    termsApi.get.mockResolvedValue(GUARDIAN_PENDING);
    guardianApi.get.mockRejectedValue(NOT_FOUND);
    const vm = await renderVm();

    let result;
    await act(async () => {
        result = await vm().recordTerms();
    });

    expect(result).toMatch(/acudiente/);
    expect(termsApi.accept).not.toHaveBeenCalled();
});

test("a server error recording the terms is returned, not swallowed", async () => {
    termsApi.get.mockResolvedValue(TERMS_PENDING);
    guardianApi.get.mockResolvedValue({ guardianId: "g-1", ...FORM });
    termsApi.accept.mockRejectedValue(new Error("Forbidden"));
    const vm = await renderVm();

    let result;
    await act(async () => {
        result = await vm().recordTerms();
    });

    expect(result).toBe("Forbidden");
    expect(consentApi.accept).not.toHaveBeenCalled();
});

test("a failure reading the state is shown", async () => {
    termsApi.get.mockRejectedValue(new Error("boom"));

    const vm = await renderVm();

    expect(vm().error).toBe("boom");
});

describe("validateGuardian", () => {
    test("accepts a complete guardian", () => {
        expect(validateGuardian(FORM)).toBeNull();
    });

    test.each([
        [{ fullName: " " }, /nombre completo/],
        [{ documentType: "TI" }, /CC, CE o PP/],
        [{ documentNumber: "" }, /número de documento/],
        [{ relationship: "" }, /parentesco/],
        [{ email: "", phone: "" }, /correo o un teléfono/],
        [{ email: "no-es-correo" }, /no es válido/],
    ])("refuses %j", (patch, message) => {
        expect(validateGuardian({ ...FORM, ...patch })).toMatch(message);
    });
});
