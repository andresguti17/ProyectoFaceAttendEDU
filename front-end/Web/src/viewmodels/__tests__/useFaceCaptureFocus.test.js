// ============================================================
//  La cámara debe apagarse al salir de la sección: la pantalla queda
//  montada bajo la siguiente del stack, así que el cleanup de
//  desmontaje nunca corre (la luz de la cámara seguía encendida).
// ============================================================

import React from "react";
import { create, act } from "react-test-renderer";
import { NavigationContext } from "@react-navigation/native";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../services/api/biometricCaptureApi", () => ({ biometricCaptureApi: {} }));
jest.mock("../../services/api/referenceData", () => ({ personMap: jest.fn(), fullName: () => "" }));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (s) => s }) }));

import { useFaceCapture } from "../useFaceCapture";

const vm = { run: (op) => op(), setStatus: jest.fn(), requirePersonId: jest.fn(), refreshSummary: jest.fn() };

function fakeNavigation() {
    const listeners = { blur: new Set(), focus: new Set() };
    return {
        addListener: (event, handler) => {
            listeners[event].add(handler);
            return () => listeners[event].delete(handler);
        },
        emit: (event) => listeners[event].forEach((handler) => handler()),
        count: (event) => listeners[event].size,
    };
}

function fakeStream() {
    const track = { stop: jest.fn() };
    return { track, getTracks: () => [track] };
}

function mountHook(navigation) {
    let hook;
    function Probe() {
        hook = useFaceCapture({ vm });
        return null;
    }
    let renderer;
    act(() => {
        renderer = create(
            <NavigationContext.Provider value={navigation}>
                <Probe />
            </NavigationContext.Provider>
        );
    });
    hook.videoRef.current = { play: jest.fn().mockResolvedValue(), srcObject: null };
    return { getHook: () => hook, renderer };
}

let getUserMedia;

beforeEach(() => {
    getUserMedia = jest.fn();
    Object.defineProperty(global.navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia },
    });
});

test("blur releases the camera and focus turns it back on", async () => {
    const first = fakeStream();
    const second = fakeStream();
    getUserMedia.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const navigation = fakeNavigation();
    const { getHook } = mountHook(navigation);

    await act(async () => {
        await getHook().startCamera();
    });
    expect(getHook().cameraReady).toBe(true);

    await act(async () => {
        navigation.emit("blur");
    });
    expect(first.track.stop).toHaveBeenCalled();
    expect(getHook().cameraReady).toBe(false);
    expect(getHook().videoRef.current.srcObject).toBeNull();

    await act(async () => {
        navigation.emit("focus");
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getHook().cameraReady).toBe(true);
});

test("focus does not start a camera that was never turned on", async () => {
    const navigation = fakeNavigation();
    mountHook(navigation);

    await act(async () => {
        navigation.emit("blur");
        navigation.emit("focus");
    });

    expect(getUserMedia).not.toHaveBeenCalled();
});

test("a permission granted after leaving the section is released right away", async () => {
    const late = fakeStream();
    let resolveStream;
    getUserMedia.mockReturnValueOnce(new Promise((resolve) => { resolveStream = resolve; }));
    const navigation = fakeNavigation();
    const { getHook } = mountHook(navigation);

    let pending;
    act(() => {
        pending = getHook().startCamera();
    });
    await act(async () => {
        navigation.emit("blur");
    });
    await act(async () => {
        resolveStream(late);
        await pending;
    });

    expect(late.track.stop).toHaveBeenCalled();
    expect(getHook().cameraReady).toBe(false);
});

test("listeners are removed on unmount", () => {
    const navigation = fakeNavigation();
    const { renderer } = mountHook(navigation);
    expect(navigation.count("blur")).toBe(1);

    act(() => renderer.unmount());

    expect(navigation.count("blur")).toBe(0);
    expect(navigation.count("focus")).toBe(0);
});
