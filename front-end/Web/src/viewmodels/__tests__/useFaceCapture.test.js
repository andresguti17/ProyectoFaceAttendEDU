import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../services/api/biometricCaptureApi", () => ({
    biometricCaptureApi: {
        livenessChallenge: jest.fn().mockResolvedValue({ challenge_token: "t0", actions: ["blink", "turn"] }),
        livenessStep: jest.fn().mockResolvedValue({ challenge_token: "t1", completed: true }),
        identifyFace: jest.fn(),
    },
}));
jest.mock("../../services/api/referenceData", () => ({ personMap: jest.fn().mockResolvedValue(new Map()), fullName: () => "" }));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (s) => s }) }));

import { useFaceCapture } from "../useFaceCapture";
import { biometricCaptureApi } from "../../services/api/biometricCaptureApi";

function renderHook(props) {
    let vm;
    function Probe() {
        vm = useFaceCapture(props);
        return null;
    }
    act(() => { create(<Probe />); });
    return () => vm;
}

beforeEach(() => {
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: () => {} });
    jest.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,x");
});

test("loginFace sends facial.identify_image over the socket and calls onIdentified with the ack result", async () => {
    const socket = { send: jest.fn().mockResolvedValue({ person_id: "p1", score: 0.9 }) };
    const vm = { run: (op) => op(), setStatus: jest.fn(), requirePersonId: jest.fn() };
    const onIdentified = jest.fn();
    const getHook = renderHook({ vm, socket, onIdentified });
    getHook().videoRef.current = { videoWidth: 10, videoHeight: 10 };

    await act(async () => {
        await getHook().loginFace();
    });

    expect(socket.send).toHaveBeenCalledWith(
        "facial.identify_image",
        expect.objectContaining({ challenge_token: expect.any(String) })
    );
    expect(onIdentified).toHaveBeenCalledWith({ person_id: "p1", score: 0.9 });
    expect(biometricCaptureApi.identifyFace).not.toHaveBeenCalled();
});

test("loginFace without socket/onIdentified (admin screen usage) keeps using REST identifyFace unchanged", async () => {
    biometricCaptureApi.identifyFace.mockResolvedValue({ person_id: "p2", score: 0.8 });
    const vm = { run: (op) => op(), setStatus: jest.fn(), requirePersonId: jest.fn() };
    const getHook = renderHook({ vm });
    getHook().videoRef.current = { videoWidth: 10, videoHeight: 10 };

    await act(async () => {
        await getHook().loginFace();
    });

    expect(biometricCaptureApi.identifyFace).toHaveBeenCalled();
});

test("loginFace without a socket but with onIdentified still calls onIdentified via the REST result", async () => {
    biometricCaptureApi.identifyFace.mockResolvedValue({ person_id: "p2", score: 0.8 });
    const vm = { run: (op) => op(), setStatus: jest.fn(), requirePersonId: jest.fn() };
    const onIdentified = jest.fn();
    const getHook = renderHook({ vm, onIdentified });
    getHook().videoRef.current = { videoWidth: 10, videoHeight: 10 };

    await act(async () => {
        await getHook().loginFace();
    });

    expect(biometricCaptureApi.identifyFace).toHaveBeenCalled();
    expect(onIdentified).toHaveBeenCalledWith({ person_id: "p2", score: 0.8 });
});

test("the liveness challenge announces every gesture the screen can show, without the legacy turn", async () => {
    biometricCaptureApi.identifyFace.mockResolvedValue({ person_id: "p3", score: 0.9 });
    const vm = { run: (op) => op(), setStatus: jest.fn(), requirePersonId: jest.fn() };
    const getHook = renderHook({ vm });
    getHook().videoRef.current = { videoWidth: 10, videoHeight: 10 };

    await act(async () => {
        await getHook().loginFace();
    });

    const supported = biometricCaptureApi.livenessChallenge.mock.calls.at(-1)[1];
    expect(supported).toEqual(expect.arrayContaining(["blink", "open_mouth", "turn_left", "turn_right", "smile", "nod"]));
    expect(supported).not.toContain("turn");
});


test("a 200 with detected:false is a failed gesture attempt: it is repeated and then reported, never identified", async () => {
    biometricCaptureApi.livenessStep.mockResolvedValue({ challenge_token: "t0", completed: false, detected: false });
    biometricCaptureApi.identifyFace.mockClear();
    biometricCaptureApi.livenessStep.mockClear();
    const vm = { run: (op) => op(), setStatus: jest.fn(), requirePersonId: jest.fn() };
    const getHook = renderHook({ vm });
    getHook().videoRef.current = { videoWidth: 10, videoHeight: 10 };

    await act(async () => {
        await expect(getHook().loginFace()).rejects.toThrow("Liveness gesture not detected");
    });

    expect(biometricCaptureApi.livenessStep).toHaveBeenCalledTimes(2); // GESTURE_ATTEMPTS
    expect(biometricCaptureApi.identifyFace).not.toHaveBeenCalled();
}, 30000);
