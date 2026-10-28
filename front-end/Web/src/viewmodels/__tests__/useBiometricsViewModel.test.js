globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mockT = (s) => s;
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock("../../services/api/biometricCaptureApi", () => ({
    biometricCaptureApi: {
        health: jest.fn(async () => ({ status: "ok" })),
        summary: jest.fn(async () => ({ has_face: false, has_fingerprint: false })),
    },
}));
jest.mock("../../services/api/consentApi", () => ({
    consentApi: { get: jest.fn(async () => ({ biometricAuthorized: true })), accept: jest.fn() },
}));

jest.mock("../../services/api/termsApi", () => ({ termsApi: { get: jest.fn(async () => ({ enabled: true })) } }));

import React from "react";
import { act, create } from "react-test-renderer";
import { useBiometricsViewModel } from "../useBiometricsViewModel";
import { termsApi } from "../../services/api/termsApi";

// Regresión: `authorizeBiometrics` leía `run` y `requirePersonId` antes de declararlos
// (TDZ). Como el array de dependencias se evalúa al renderizar, el hook lanzaba
// "Cannot access ... before initialization" y la pantalla quedaba en blanco.
test("mounts the real view model without a temporal-dead-zone error", async () => {
    let vm;
    function Probe() {
        vm = useBiometricsViewModel();
        return null;
    }
    await act(async () => {
        create(<Probe />);
    });
    expect(typeof vm.authorizeBiometrics).toBe("function");
    expect(typeof vm.setPerson).toBe("function");
});

async function mountWithPerson() {
    let vm;
    function Probe() {
        vm = useBiometricsViewModel();
        return null;
    }
    await act(async () => {
        create(<Probe />);
    });
    await act(async () => {
        vm.setPerson({ personId: "p-1", name: "Diego" });
    });
    return () => vm;
}

test("an enabled person has nothing pending", async () => {
    const vm = await mountWithPerson();
    expect(vm().termsPending).toBeNull();
});

test("a person whose terms are pending exposes the pending step before any capture", async () => {
    termsApi.get.mockResolvedValueOnce({ enabled: false, minor: false, pendingStep: "TERMS" });
    const vm = await mountWithPerson();
    expect(vm().termsPending).toEqual({ gate: "ACCEPT", step: "TERMS", minor: false });
});

test("a minor without guardian exposes the GUARDIAN step", async () => {
    termsApi.get.mockResolvedValueOnce({ enabled: false, minor: true, pendingStep: "GUARDIAN" });
    const vm = await mountWithPerson();
    expect(vm().termsPending).toEqual({ gate: "BLOCKED", step: "GUARDIAN", minor: true });
});

test("if identity cannot answer the UI is not blocked: the server stays the authority", async () => {
    termsApi.get.mockRejectedValueOnce(new Error("503"));
    const vm = await mountWithPerson();
    expect(vm().termsPending).toBeNull();
});

test("a PERSON_NOT_ENABLED rejection becomes a clear message and refreshes the pending step", async () => {
    const vm = await mountWithPerson();
    termsApi.get.mockResolvedValueOnce({ enabled: false, minor: false, pendingStep: "TERMS" });
    await act(async () => {
        await vm().run(async () => {
            throw Object.assign(new Error("The person cannot use biometric features yet; pending step: TERMS"), {
                code: "PERSON_NOT_ENABLED",
            });
        });
    });
    expect(vm().status.text).toBe("La persona aún no está habilitada para usar la biometría.");
    expect(vm().termsPending?.step).toBe("TERMS");
});

test("other errors keep their own message", async () => {
    const vm = await mountWithPerson();
    await act(async () => {
        await vm().run(async () => {
            throw new Error("boom");
        });
    });
    expect(vm().status.text).toBe("boom");
});
