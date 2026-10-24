import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../services/api/biometricCaptureApi", () => ({
    biometricCaptureApi: {
        health: jest.fn().mockResolvedValue({ status: "ok" }),
        summary: jest.fn().mockResolvedValue({ has_face: false, has_fingerprint: false }),
    },
}));
jest.mock("../../services/api/consentApi", () => ({
    consentApi: {
        get: jest.fn().mockResolvedValue({ biometricAuthorized: false }),
        accept: jest.fn().mockResolvedValue({}),
    },
}));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (text) => text }) }));

import { useBiometricsViewModel } from "../useBiometricsViewModel";
import { consentApi } from "../../services/api/consentApi";

function mount() {
    let vm;
    function Probe() {
        vm = useBiometricsViewModel();
        return null;
    }
    act(() => {
        create(<Probe />);
    });
    return () => vm;
}

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

test("renders without reading a hook callback before it is declared", async () => {
    const getVm = mount();
    await flush();
    expect(typeof getVm().authorizeBiometrics).toBe("function");
});

test("authorizeBiometrics records the consent of the selected person", async () => {
    const getVm = mount();
    await flush();
    act(() => getVm().setPerson({ personId: "p-1", name: "Ana" }));
    await flush();
    await act(async () => { await getVm().authorizeBiometrics(); });
    expect(consentApi.accept).toHaveBeenCalledWith("p-1", { biometricAccepted: true });
});
