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

import React from "react";
import { act, create } from "react-test-renderer";
import { useBiometricsViewModel } from "../useBiometricsViewModel";

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
