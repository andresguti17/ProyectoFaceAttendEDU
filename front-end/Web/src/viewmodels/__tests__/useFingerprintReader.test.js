import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../services/api/biometricCaptureApi", () => ({
    biometricCaptureApi: { identifyFingerprint: jest.fn(), enrollFingerprint: jest.fn() },
}));
jest.mock("../../services/api/referenceData", () => ({ personMap: jest.fn().mockResolvedValue(new Map()), fullName: () => "" }));
// t must be a stable reference across renders: useFingerprintReader's mount effect depends
// (transitively, via refreshReader) on `t`, so a fresh function per render would retrigger
// the effect's cleanup on every state update and wipe the captured sample mid-test.
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => {
    const t = (s) => s;
    return { useTranslation: () => ({ t }) };
});

import { useFingerprintReader } from "../useFingerprintReader";
import { biometricCaptureApi } from "../../services/api/biometricCaptureApi";

function renderHook(props) {
    let vm;
    function Probe() {
        vm = useFingerprintReader(props);
        return null;
    }
    act(() => { create(<Probe />); });
    return () => vm;
}

test("loginFingerprint sends fingerprint.identify_sample over the socket and calls onIdentified with the ack result", async () => {
    const socket = { send: jest.fn().mockResolvedValue({ person_id: "p1", finger_number: 1, score: 1 }) };
    const vm = { run: (op) => op(), setStatus: jest.fn() };
    const onIdentified = jest.fn();
    const getHook = renderHook({ vm, socket, onIdentified });

    act(() => {
        getHook().__setSampleForTest({ format: 1, data: "abc", quality: 80 });
    });

    await act(async () => {
        await getHook().loginFingerprint();
    });

    expect(socket.send).toHaveBeenCalledWith(
        "fingerprint.identify_sample",
        { sample_format: 1, data_base64: "abc", quality: 80, finger_number: undefined }
    );
    expect(onIdentified).toHaveBeenCalledWith({ person_id: "p1", finger_number: 1, score: 1 });
    expect(biometricCaptureApi.identifyFingerprint).not.toHaveBeenCalled();
});

test("loginFingerprint without socket/onIdentified (admin screen usage) keeps using REST identifyFingerprint unchanged", async () => {
    biometricCaptureApi.identifyFingerprint.mockResolvedValue({ person_id: "p2" });
    const vm = { run: (op) => op(), setStatus: jest.fn() };
    const getHook = renderHook({ vm });

    act(() => {
        getHook().__setSampleForTest({ format: 1, data: "abc", quality: 80 });
    });

    await act(async () => {
        await getHook().loginFingerprint();
    });

    expect(biometricCaptureApi.identifyFingerprint).toHaveBeenCalledWith({
        sampleFormat: 1,
        data: "abc",
        quality: 80,
    });
});

test("loginFingerprint without a socket but with onIdentified still calls onIdentified via the REST result", async () => {
    biometricCaptureApi.identifyFingerprint.mockResolvedValue({ person_id: "p2", finger_number: 1, score: 0.7 });
    const vm = { run: (op) => op(), setStatus: jest.fn() };
    const onIdentified = jest.fn();
    const getHook = renderHook({ vm, onIdentified });

    act(() => {
        getHook().__setSampleForTest({ format: 1, data: "abc", quality: 80 });
    });

    await act(async () => {
        await getHook().loginFingerprint();
    });

    expect(biometricCaptureApi.identifyFingerprint).toHaveBeenCalled();
    expect(onIdentified).toHaveBeenCalledWith({ person_id: "p2", finger_number: 1, score: 0.7 });
});

test("saveFingerprint (enroll) always uses REST regardless of socket", async () => {
    biometricCaptureApi.enrollFingerprint.mockResolvedValue({});
    const socket = { send: jest.fn() };
    const vm = { run: (op) => op(), setStatus: jest.fn(), requirePersonId: () => "person-1", refreshSummary: jest.fn() };
    const getHook = renderHook({ vm, socket });

    act(() => {
        getHook().__setSampleForTest({ format: 1, data: "abc", quality: 80 });
    });

    await act(async () => {
        await getHook().saveFingerprint();
    });

    expect(biometricCaptureApi.enrollFingerprint).toHaveBeenCalled();
    expect(socket.send).not.toHaveBeenCalled();
});
