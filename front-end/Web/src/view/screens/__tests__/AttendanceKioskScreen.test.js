import React from "react";
import { create, act } from "react-test-renderer";
import { Text } from "react-native";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../../viewmodels/useRolePermissions", () => ({ useRolePermissions: jest.fn() }));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({}), useRoute: () => ({}) }));
jest.mock("../../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));
// Mocked wholesale for the CapturePanel tests below: those tests target
// AttendanceKioskView's own sequencing logic (arm the reader, then identify
// once a sample exists), not the real browser/SDK capture hooks.
jest.mock("../../../viewmodels/useAttendanceKioskViewModel", () => ({
    useAttendanceKioskViewModel: jest.fn(),
}));
jest.mock("../../../viewmodels/useFaceCapture", () => ({ useFaceCapture: jest.fn() }));
jest.mock("../../../viewmodels/useFingerprintReader", () => ({ useFingerprintReader: jest.fn() }));
// PageHeader also calls useResponsive(), which needs a ResponsiveProvider ->
// SafeAreaProvider chain this test suite has never set up for any screen.
// Unrelated to the sequencing logic under test here, so it's stubbed out
// rather than growing an app-shell provider stack just to satisfy it.
jest.mock("../../components/common/navigation/PageHeader", () => ({
    PageHeader: () => null,
}));
// Feather's real componentDidMount kicks off expo-font/expo-asset loading
// that has no asset registry in this Jest environment; it rejects
// asynchronously and only surfaces once something flushes microtasks (the
// `await act(async () => {})` calls below), misattributed to whichever test
// happens to flush next. Unrelated to the sequencing logic under test.
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

// NotAuthorized (rendered on the rejection path below) calls useTheme(), which
// throws outside a <ThemeProvider> — same adjustment the existing
// TextInput.test.js makes for the same reason. The brief's test as written
// doesn't wrap one; this is the one tweak needed for it to match reality.
import { ThemeProvider } from "../../../context/ThemeContext";
import { useRolePermissions } from "../../../viewmodels/useRolePermissions";
import { useAttendanceKioskViewModel } from "../../../viewmodels/useAttendanceKioskViewModel";
import { useFaceCapture } from "../../../viewmodels/useFaceCapture";
import { useFingerprintReader } from "../../../viewmodels/useFingerprintReader";
import { Button } from "../../components/common/buttons/Button";
import AttendanceKioskScreen from "../AttendanceKioskScreen";

function withProviders(children) {
    // NotAuthorized/Card/Button all call useTheme(), which throws outside a
    // <ThemeProvider> — same adjustment the existing TextInput.test.js
    // already makes for the same reason.
    return <ThemeProvider>{children}</ThemeProvider>;
}

function renderScreen() {
    let tree;
    act(() => {
        tree = create(withProviders(<AttendanceKioskScreen />));
    });
    return tree;
}

function rerenderScreen(tree) {
    act(() => {
        tree.update(withProviders(<AttendanceKioskScreen />));
    });
}

function findButton(tree, label) {
    return tree.root.findAllByType(Button).find((b) => b.props.children === label);
}

function hasText(tree, label) {
    return tree.root.findAllByType(Text).some((n) => n.props.children === label);
}

beforeEach(() => {
    jest.clearAllMocks();
    useRolePermissions.mockReturnValue({ canRegisterFace: false });
    useFaceCapture.mockReturnValue({
        startCamera: jest.fn(),
        cameraReady: false, // keeps the passive face loop out of these tests
        loginFace: jest.fn().mockResolvedValue({}),
    });
});

test("blocks access when the user lacks canRegisterFace", () => {
    const tree = renderScreen();
    expect(tree.toJSON()).toBeTruthy(); // renderiza el componente NotAuthorized, no crashea
});

describe("kiosk fingerprint capture (regression: Usa tu huella used to call loginFingerprint directly)", () => {
    let kioskVm;
    let fingerprint;

    beforeEach(() => {
        useRolePermissions.mockReturnValue({ canRegisterFace: true });

        kioskVm = {
            view: "WAITING",
            todaysBlocks: [],
            startClass: jest.fn(),
            endClass: jest.fn().mockResolvedValue(undefined),
            session: { classSessionId: 1 },
            statusMessage: "",
            socket: null,
            registeredActorIds: new Set(),
            registeredMethods: new Map(),
            roster: [],
            onIdentified: jest.fn(),
            onCaptureError: jest.fn(),
        };
        useAttendanceKioskViewModel.mockReturnValue(kioskVm);

        fingerprint = {
            deviceReady: true,
            sampleReady: false,
            startCapture: jest.fn(),
            loginFingerprint: jest.fn().mockResolvedValue({ person_id: "p1", score: 1 }),
        };
        useFingerprintReader.mockReturnValue(fingerprint);
    });

    test('pressing "Usa tu huella" arms the reader (startCapture) without calling loginFingerprint yet', () => {
        const tree = renderScreen();

        act(() => {
            findButton(tree, "Usa tu huella").props.onPress();
        });

        // This is the exact bug the reviewer caught: the old code called
        // fingerprint.loginFingerprint() straight from the button, which
        // throws synchronously ("Captura una huella primero.") because no
        // sample exists yet — takeSample() inside the real hook reads
        // stateRef.current.sample, only populated by onSamplesAcquired after
        // startCapture() has actually armed the reader.
        expect(fingerprint.startCapture).toHaveBeenCalledTimes(1);
        expect(fingerprint.loginFingerprint).not.toHaveBeenCalled();
        expect(kioskVm.onCaptureError).not.toHaveBeenCalled();
    });

    test("loginFingerprint fires automatically once sampleReady flips true, with no second button press", async () => {
        const tree = renderScreen();

        act(() => {
            findButton(tree, "Usa tu huella").props.onPress();
        });
        expect(fingerprint.loginFingerprint).not.toHaveBeenCalled();

        // Simulates what the real DigitalPersona SDK does via
        // onSamplesAcquired: once a finger is read, the hook flips
        // sampleReady to true on the same (mocked) object reference.
        fingerprint.sampleReady = true;
        rerenderScreen(tree);
        // Flush the loginFingerprint() promise chain + its .finally().
        await act(async () => {});

        expect(fingerprint.loginFingerprint).toHaveBeenCalledTimes(1);
        // Armed only once for this single touch — no extra re-arm loop.
        expect(fingerprint.startCapture).toHaveBeenCalledTimes(1);
        expect(kioskVm.onCaptureError).not.toHaveBeenCalled();

        // activeCapture resets to null once the identify settles: the banner
        // should fall back to the idle WAITING message, and the button
        // should be enabled again for the next student.
        rerenderScreen(tree);
        expect(findButton(tree, "Usa tu huella").props.disabled).toBe(false);
    });

    test("a failed identify surfaces through onCaptureError and does not retry on its own", async () => {
        fingerprint.loginFingerprint = jest.fn().mockRejectedValue(new Error("sin coincidencia"));
        useFingerprintReader.mockReturnValue(fingerprint);

        const tree = renderScreen();
        act(() => {
            findButton(tree, "Usa tu huella").props.onPress();
        });

        fingerprint.sampleReady = true;
        rerenderScreen(tree);
        await act(async () => {});

        expect(kioskVm.onCaptureError).toHaveBeenCalledWith("sin coincidencia");
        expect(fingerprint.loginFingerprint).toHaveBeenCalledTimes(1);

        // activeCapture is back to null (the failed attempt finished), but
        // sampleReady is still true (the hook never consumed the stale
        // sample on a rejection) — re-rendering again must NOT re-fire
        // loginFingerprint on its own; only a fresh button press (which
        // re-arms and clears the stale sample) should.
        rerenderScreen(tree);
        await act(async () => {});
        expect(fingerprint.loginFingerprint).toHaveBeenCalledTimes(1);
    });
});

describe("kiosk end-class button", () => {
    test('"Finalizar clase" surfaces a rejected endClass() through onCaptureError instead of an unhandled rejection', async () => {
        useRolePermissions.mockReturnValue({ canRegisterFace: true });
        const kioskVm = {
            view: "WAITING",
            todaysBlocks: [],
            startClass: jest.fn(),
            endClass: jest.fn().mockRejectedValue(new Error("no se pudo cerrar la sesión")),
            session: { classSessionId: 1 },
            statusMessage: "",
            socket: null,
            registeredActorIds: new Set(),
            registeredMethods: new Map(),
            roster: [],
            onIdentified: jest.fn(),
            onCaptureError: jest.fn(),
        };
        useAttendanceKioskViewModel.mockReturnValue(kioskVm);
        useFingerprintReader.mockReturnValue({
            deviceReady: false,
            sampleReady: false,
            startCapture: jest.fn(),
            loginFingerprint: jest.fn(),
        });

        const tree = renderScreen();
        await act(async () => {
            findButton(tree, "Finalizar clase").props.onPress();
        });

        expect(kioskVm.endClass).toHaveBeenCalledTimes(1);
        expect(kioskVm.onCaptureError).toHaveBeenCalledWith("no se pudo cerrar la sesión");
    });
});

describe("kiosk passive face loop (regression: locked up after one student — Critical #2)", () => {
    let kioskVm;
    let face;

    beforeEach(() => {
        jest.useFakeTimers();
        useRolePermissions.mockReturnValue({ canRegisterFace: true });
        kioskVm = {
            view: "WAITING",
            todaysBlocks: [],
            startClass: jest.fn(),
            endClass: jest.fn().mockResolvedValue(undefined),
            session: { classSessionId: 1 },
            statusMessage: "",
            socket: null,
            connectionStatus: "open",
            registeredActorIds: new Set(),
            registeredMethods: new Map(),
            roster: [],
            onIdentified: jest.fn(),
            onCaptureError: jest.fn(),
        };
        useAttendanceKioskViewModel.mockReturnValue(kioskVm);

        face = {
            startCamera: jest.fn(),
            cameraReady: true,
            loginFace: jest.fn().mockResolvedValue({}),
            videoRef: { current: null },
            livenessAction: "",
        };
        useFaceCapture.mockReturnValue(face);
        useFingerprintReader.mockReturnValue({
            deviceReady: false,
            sampleReady: false,
            startCapture: jest.fn(),
            loginFingerprint: jest.fn(),
        });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test("loginFace runs again after a WAITING -> SUCCESS -> WAITING cycle, with activeCapture reset to null in between", async () => {
        const tree = renderScreen();

        // Flush the loop's first attempt: starts, awaits loginFace (resolves
        // instantly here), and resets activeCapture back to null before its
        // inter-attempt pause (which never elapses — fake timers, not advanced).
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(face.loginFace).toHaveBeenCalledTimes(1);
        // The old bug: activeCapture stuck on "FACE" forever after the first
        // attempt. It must be back to the idle WAITING banner here.
        expect(hasText(tree, "Acércate al lector")).toBe(true);
        expect(hasText(tree, "Verificando rostro...")).toBe(false);

        // Mirrors what the real viewmodel does after a successful identify:
        // leave WAITING for a couple of seconds, then come back to it.
        kioskVm = { ...kioskVm, view: "SUCCESS" };
        useAttendanceKioskViewModel.mockReturnValue(kioskVm);
        rerenderScreen(tree);

        kioskVm = { ...kioskVm, view: "WAITING" };
        useAttendanceKioskViewModel.mockReturnValue(kioskVm);
        rerenderScreen(tree);

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        // This is the exact regression: with the bug, loginFace would never
        // be called a second time and the screen would stay stuck.
        expect(face.loginFace).toHaveBeenCalledTimes(2);
        expect(hasText(tree, "Acércate al lector")).toBe(true);
    });
});

describe("kiosk roster panel", () => {
    test("shows each enrolled student, marking the registered ones with their method", () => {
        useRolePermissions.mockReturnValue({ canRegisterFace: true });
        useAttendanceKioskViewModel.mockReturnValue({
            view: "WAITING",
            todaysBlocks: [],
            startClass: jest.fn(),
            endClass: jest.fn().mockResolvedValue(undefined),
            session: { classSessionId: 1 },
            statusMessage: "",
            socket: null,
            connectionStatus: "open",
            registeredActorIds: new Set([1]),
            registeredMethods: new Map([[1, "FACIAL"]]),
            roster: [
                { academicActorId: 1, personId: "person-a", name: "Ana Gómez" },
                { academicActorId: 2, personId: "person-b", name: "Beto Ruiz" },
            ],
            onIdentified: jest.fn(),
            onCaptureError: jest.fn(),
        });
        useFingerprintReader.mockReturnValue({
            deviceReady: false,
            sampleReady: false,
            startCapture: jest.fn(),
            loginFingerprint: jest.fn(),
        });

        const tree = renderScreen();

        expect(hasText(tree, "Ana Gómez")).toBe(true);
        expect(hasText(tree, "Beto Ruiz")).toBe(true);
        expect(hasText(tree, "Rostro")).toBe(true); // el método de la ya registrada
    });
});

describe("kiosk fingerprint preemption and arm-timeout (Important #5)", () => {
    let kioskVm;

    beforeEach(() => {
        jest.useFakeTimers();
        useRolePermissions.mockReturnValue({ canRegisterFace: true });
        kioskVm = {
            view: "WAITING",
            todaysBlocks: [],
            startClass: jest.fn(),
            endClass: jest.fn().mockResolvedValue(undefined),
            session: { classSessionId: 1 },
            statusMessage: "",
            socket: null,
            connectionStatus: "open",
            registeredActorIds: new Set(),
            registeredMethods: new Map(),
            roster: [],
            onIdentified: jest.fn(),
            onCaptureError: jest.fn(),
        };
        useAttendanceKioskViewModel.mockReturnValue(kioskVm);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test("pressing 'Usa tu huella' preempts an in-flight face attempt instead of waiting for it to settle", async () => {
        let rejectLoginFace;
        useFaceCapture.mockReturnValue({
            startCamera: jest.fn(),
            cameraReady: true,
            loginFace: jest.fn(() => new Promise((_resolve, reject) => { rejectLoginFace = reject; })),
            videoRef: { current: null },
            livenessAction: "",
        });
        const fingerprint = {
            deviceReady: true,
            sampleReady: false,
            startCapture: jest.fn(),
            loginFingerprint: jest.fn(),
        };
        useFingerprintReader.mockReturnValue(fingerprint);

        const tree = renderScreen();
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(hasText(tree, "Verificando rostro...")).toBe(true); // face attempt in flight

        act(() => {
            findButton(tree, "Usa tu huella").props.onPress();
        });
        expect(fingerprint.startCapture).toHaveBeenCalledTimes(1);
        expect(findButton(tree, "Usa tu huella").props.disabled).toBe(true); // now the active capture

        // The preempted face attempt finally settles (with a rejection, e.g.
        // "no match") — it must be ignored, not surfaced as an error, and
        // must not clobber the fingerprint attempt that superseded it.
        await act(async () => {
            rejectLoginFace(new Error("sin coincidencia"));
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(kioskVm.onCaptureError).not.toHaveBeenCalled();
        expect(findButton(tree, "Usa tu huella").props.disabled).toBe(true); // still "FINGER", untouched
        expect(fingerprint.loginFingerprint).not.toHaveBeenCalled();
    });

    test("the fingerprint arm-timeout releases the reader and resets activeCapture if no sample ever arrives", async () => {
        useFaceCapture.mockReturnValue({
            startCamera: jest.fn(),
            cameraReady: false, // keep the passive face loop out of this test
            loginFace: jest.fn().mockResolvedValue({}),
        });
        const fingerprint = {
            deviceReady: true,
            sampleReady: false,
            startCapture: jest.fn(),
            stopCapture: jest.fn(),
            loginFingerprint: jest.fn(),
        };
        useFingerprintReader.mockReturnValue(fingerprint);

        const tree = renderScreen();
        act(() => {
            findButton(tree, "Usa tu huella").props.onPress();
        });
        expect(fingerprint.startCapture).toHaveBeenCalledTimes(1);
        expect(findButton(tree, "Usa tu huella").props.disabled).toBe(true);

        act(() => {
            jest.advanceTimersByTime(15000);
        });

        expect(fingerprint.stopCapture).toHaveBeenCalledTimes(1);
        rerenderScreen(tree);
        expect(findButton(tree, "Usa tu huella").props.disabled).toBe(false);
        expect(kioskVm.onCaptureError).not.toHaveBeenCalled(); // a timeout is not an error, just a reset
    });
});
