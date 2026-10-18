import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../context/AuthContext", () => ({
    useAuth: () => ({ user: { academicActorId: 7 } }),
}));
jest.mock("../../services/api/referenceData", () => ({
    listBlocks: jest.fn(),
    cohortActorByPerson: jest.fn().mockResolvedValue(new Map()),
    cohortRoster: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../services/api/schedulingApi", () => ({
    schedulingApi: {
        listSessions: jest.fn(),
        createSession: jest.fn(),
        openSession: jest.fn(),
        closeSession: jest.fn(),
    },
}));
jest.mock("../../services/api/attendanceApi", () => ({
    attendanceApi: { recordsBySession: jest.fn().mockResolvedValue([]), createRecord: jest.fn() },
}));
jest.mock("../../services/ws/biometricSocket", () => ({ connectBiometricSocket: jest.fn() }));

import { listBlocks, cohortActorByPerson, cohortRoster } from "../../services/api/referenceData";
import { schedulingApi } from "../../services/api/schedulingApi";
import { attendanceApi } from "../../services/api/attendanceApi";
import { connectBiometricSocket } from "../../services/ws/biometricSocket";
import { useAttendanceKioskViewModel, todayLocalDate } from "../useAttendanceKioskViewModel";

function renderHook() {
    let vm;
    function Probe() {
        vm = useAttendanceKioskViewModel();
        return null;
    }
    act(() => { create(<Probe />); });
    return () => vm;
}

beforeEach(() => {
    jest.clearAllMocks();
    cohortActorByPerson.mockResolvedValue(new Map());
    attendanceApi.recordsBySession.mockResolvedValue([]);
    connectBiometricSocket.mockReturnValue({
        send: jest.fn(),
        onAttendanceEvent: jest.fn(() => () => {}),
        onStatusChange: jest.fn(() => () => {}),
        close: jest.fn(),
    });
});

test("todaysBlocks only includes blocks for this instructor on today's ISO weekday", async () => {
    const isoToday = ((new Date().getDay() + 6) % 7) + 1; // getDay(): 0=domingo..6=sábado -> ISO 1..7
    listBlocks.mockResolvedValue([
        { scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: isoToday, cohortId: 10 },
        { scheduleBlockId: 2, instructorActorId: 99, dayOfWeek: isoToday, cohortId: 11 }, // otro profesor
        { scheduleBlockId: 3, instructorActorId: 7, dayOfWeek: isoToday === 1 ? 2 : 1, cohortId: 12 }, // otro día
    ]);
    const getVm = renderHook();

    await act(async () => {}); // deja resolver el efecto de carga

    expect(getVm().todaysBlocks.map((b) => b.scheduleBlockId)).toEqual([1]);
});

test("startClass creates today's session when none exists yet, then opens it", async () => {
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: ((new Date().getDay() + 6) % 7) + 1, cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([]); // no hay sesión de hoy todavía
    schedulingApi.createSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Created" });
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    const getVm = renderHook();
    await act(async () => {});

    await act(async () => {
        await getVm().startClass(getVm().todaysBlocks[0]);
    });

    expect(schedulingApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleBlockId: 1 })
    );
    // user.academicActorId (7, mocked useAuth above) is sent as openedBy —
    // AGENTS.md §6 regla 8 requires recording who opened/closed a session.
    expect(schedulingApi.openSession).toHaveBeenCalledWith(55, 7);
    expect(getVm().view).toBe("WAITING");
});

test("startClass reuses today's session and tolerates it already being Open", async () => {
    const today = todayLocalDate();
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: ((new Date().getDay() + 6) % 7) + 1, cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([
        { classSessionId: 55, scheduleBlockId: 1, sessionDate: today, sessionStatus: "Open" },
    ]);
    schedulingApi.openSession.mockRejectedValue({ status: 400, message: "ClassSession already Open" });
    const getVm = renderHook();
    await act(async () => {});

    await act(async () => {
        await getVm().startClass(getVm().todaysBlocks[0]);
    });

    expect(schedulingApi.createSession).not.toHaveBeenCalled();
    expect(getVm().view).toBe("WAITING");
    expect(getVm().session.classSessionId).toBe(55);
});

test("endClass closes the session and returns to SELECT_SESSION", async () => {
    const today = todayLocalDate();
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: ((new Date().getDay() + 6) % 7) + 1, cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([
        { classSessionId: 55, scheduleBlockId: 1, sessionDate: today, sessionStatus: "Open" },
    ]);
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    schedulingApi.closeSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Closed" });
    const getVm = renderHook();
    await act(async () => {});
    await act(async () => { await getVm().startClass(getVm().todaysBlocks[0]); });

    await act(async () => { await getVm().endClass(); });

    expect(schedulingApi.closeSession).toHaveBeenCalledWith(55, 7);
    expect(getVm().view).toBe("SELECT_SESSION");
});

async function startedVm({ enrolledPersonId = "person-a", academicActorId = 1, existingRecords = [] } = {}) {
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: ((new Date().getDay() + 6) % 7) + 1, cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([{ classSessionId: 55, scheduleBlockId: 1, sessionStatus: "Open" }]);
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    cohortActorByPerson.mockResolvedValue(new Map([[enrolledPersonId, academicActorId]]));
    attendanceApi.recordsBySession.mockResolvedValue(existingRecords);
    connectBiometricSocket.mockReturnValue({ send: jest.fn(), onAttendanceEvent: jest.fn(() => () => {}), onStatusChange: jest.fn(() => () => {}), close: jest.fn() });

    const getVm = renderHook();
    await act(async () => {});
    await act(async () => { await getVm().startClass(getVm().todaysBlocks[0]); });
    return getVm;
}

test("a successful identify for an enrolled person creates the attendance record and shows SUCCESS", async () => {
    attendanceApi.createRecord.mockResolvedValue({ attendanceRecordId: 1 });
    const getVm = await startedVm();

    await act(async () => {
        await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 });
    });

    expect(attendanceApi.createRecord).toHaveBeenCalledWith({
        classSessionId: 55,
        academicActorId: 1,
        attendanceStatus: "Present",
        captureMethod: "FACIAL",
        matchScore: 0.95,
    });
    expect(getVm().view).toBe("SUCCESS");
});

test("identifying the same person twice in one session shows DUPLICATE without a second HTTP call", async () => {
    attendanceApi.createRecord.mockResolvedValue({ attendanceRecordId: 1 });
    const getVm = await startedVm();
    await act(async () => { await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 }); });

    await act(async () => { await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 }); });

    expect(attendanceApi.createRecord).toHaveBeenCalledTimes(1);
    expect(getVm().view).toBe("DUPLICATE");
});

test("a 409 from createRecord (race with another kiosk) is treated as DUPLICATE, not ERROR", async () => {
    attendanceApi.createRecord.mockRejectedValue({ status: 409, message: "duplicate" });
    const getVm = await startedVm();

    await act(async () => { await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 }); });

    expect(getVm().view).toBe("DUPLICATE");
});

test("a recognized person outside this cohort shows ERROR without creating a record", async () => {
    attendanceApi.createRecord.mockResolvedValue({});
    const getVm = await startedVm({ enrolledPersonId: "person-a" });

    await act(async () => { await getVm().onIdentified("person-outsider", { biometricType: "FACIAL", score: 0.95 }); });

    expect(attendanceApi.createRecord).not.toHaveBeenCalled();
    expect(getVm().view).toBe("ERROR");
});

test("onCaptureError shows ERROR with that message (e.g. no biometric match)", async () => {
    const getVm = await startedVm();

    act(() => { getVm().onCaptureError("no match found"); });

    expect(getVm().view).toBe("ERROR");
    expect(getVm().statusMessage).toBe("no match found");
});

test("regression: a capture that was in flight when the class ended does not revive the ERROR banner over SELECT_SESSION (\"Finalizar clase\" bug)", async () => {
    schedulingApi.closeSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Closed" });
    const getVm = await startedVm();

    await act(async () => { await getVm().endClass(); });
    expect(getVm().view).toBe("SELECT_SESSION");

    // Simula un loginFace()/loginFingerprint() que seguía en vuelo cuando se
    // cerró la clase y recién ahora rechaza/resuelve — ninguno de los dos
    // debe poder revivir un banner de la sesión que ya terminó.
    act(() => { getVm().onCaptureError("socket closed mid-flight"); });
    expect(getVm().view).toBe("SELECT_SESSION");

    await act(async () => {
        await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 });
    });
    expect(getVm().view).toBe("SELECT_SESSION");
    expect(attendanceApi.createRecord).not.toHaveBeenCalled();
});

test("startClass loads the cohort roster and seeds registeredMethods from existing records' captureMethod", async () => {
    cohortRoster.mockResolvedValue([
        { academicActorId: 1, personId: "person-a", name: "Ana Gómez" },
        { academicActorId: 2, personId: "person-b", name: "Beto Ruiz" },
    ]);
    const getVm = await startedVm({ existingRecords: [{ academicActorId: 1, captureMethod: "IOT" }] });

    expect(cohortRoster).toHaveBeenCalledWith(10);
    expect(getVm().roster).toEqual([
        { academicActorId: 1, personId: "person-a", name: "Ana Gómez" },
        { academicActorId: 2, personId: "person-b", name: "Beto Ruiz" },
    ]);
    // "IOT" es lo que viaja al backend para huella (ver onIdentified); al
    // releer un registro existente se muestra de vuelta como "FINGERPRINT".
    expect(getVm().registeredMethods.get(1)).toBe("FINGERPRINT");
});

test("onIdentified records which biometric method was used, for the roster panel", async () => {
    attendanceApi.createRecord.mockResolvedValue({ attendanceRecordId: 1 });
    const getVm = await startedVm();

    await act(async () => {
        await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 });
    });

    expect(getVm().registeredMethods.get(1)).toBe("FACIAL");
});

test("a flat attendance.event frame from another kiosk (snake_case person_id, no payload wrapper) adds the resolved academicActorId to registeredActorIds", async () => {
    // No usa startedVm(): necesita capturar el listener pasado a
    // onAttendanceEvent, y startedVm() sobrescribiría este mock con uno
    // genérico al llamar startClass() internamente.
    let attendanceListener;
    connectBiometricSocket.mockReturnValue({
        send: jest.fn(),
        onAttendanceEvent: jest.fn((listener) => {
            attendanceListener = listener;
            return () => {};
        }),
        onStatusChange: jest.fn(() => () => {}),
        close: jest.fn(),
    });
    const today = todayLocalDate();
    listBlocks.mockResolvedValue([
        { scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: ((new Date().getDay() + 6) % 7) + 1, cohortId: 10 },
    ]);
    schedulingApi.listSessions.mockResolvedValue([
        { classSessionId: 55, scheduleBlockId: 1, sessionDate: today, sessionStatus: "Open" },
    ]);
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    cohortActorByPerson.mockResolvedValue(new Map([["person-a", 1]]));
    attendanceApi.recordsBySession.mockResolvedValue([]);

    const getVm = renderHook();
    await act(async () => {});
    await act(async () => { await getVm().startClass(getVm().todaysBlocks[0]); });

    act(() => {
        attendanceListener({
            type: "attendance.event",
            person_id: "person-a",
            biometric_type: "FACIAL",
            score: 0.93,
            timestamp: "2026-10-13T00:00:00Z",
            correlation_id: "corr-1",
        });
    });

    expect(getVm().registeredActorIds.has(1)).toBe(true);
    expect(attendanceApi.createRecord).not.toHaveBeenCalled();
});

// ── Fix coverage: final whole-branch review ─────────────────────────────

test("Critical #3: a fingerprint identify maps to captureMethod IOT with matchScore null, regardless of the raw SIFT score", async () => {
    // 05-ms-attendance's AttendanceRecord.ALLOWED_METHOD never includes
    // FINGERPRINT, and matchScore is a DECIMAL(5,4) checked to 0..1 — the raw
    // SIFT keypoint count (e.g. 42) the socket ack returns would violate both.
    attendanceApi.createRecord.mockResolvedValue({ attendanceRecordId: 1 });
    const getVm = await startedVm();

    await act(async () => {
        await getVm().onIdentified("person-a", { biometricType: "FINGERPRINT", score: 42 });
    });

    expect(attendanceApi.createRecord).toHaveBeenCalledWith({
        classSessionId: 55,
        academicActorId: 1,
        attendanceStatus: "Present",
        captureMethod: "IOT",
        matchScore: null,
    });
    expect(getVm().view).toBe("SUCCESS");
});

test("Important #6: connectionStatus reflects the socket's onStatusChange notifications", async () => {
    let statusListener;
    connectBiometricSocket.mockReturnValue({
        send: jest.fn(),
        onAttendanceEvent: jest.fn(() => () => {}),
        onStatusChange: jest.fn((listener) => {
            statusListener = listener;
            return () => {};
        }),
        close: jest.fn(),
    });
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: isoWeekdayNow(), cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([]);
    schedulingApi.createSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Created" });
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    const getVm = renderHook();
    await act(async () => {});

    await act(async () => {
        await getVm().startClass(getVm().todaysBlocks[0]);
    });
    expect(getVm().connectionStatus).toBe("closed"); // initial value before any notification

    act(() => { statusListener("connecting"); });
    expect(getVm().connectionStatus).toBe("connecting");

    act(() => { statusListener("reconnecting"); });
    expect(getVm().connectionStatus).toBe("reconnecting");

    act(() => { statusListener("open"); });
    expect(getVm().connectionStatus).toBe("open");
});

test("Important #8: a 400 from openSession on a Closed session is NOT silently tolerated like 'already Open'", async () => {
    const today = todayLocalDate();
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: isoWeekdayNow(), cohortId: 10 }]);
    schedulingApi.listSessions
        .mockResolvedValueOnce([{ classSessionId: 55, scheduleBlockId: 1, sessionDate: today, sessionStatus: "Closed" }])
        // Re-fetched inside the 400-handling branch to check the real status.
        .mockResolvedValueOnce([{ classSessionId: 55, scheduleBlockId: 1, sessionDate: today, sessionStatus: "Closed" }]);
    schedulingApi.openSession.mockRejectedValue({ status: 400, message: "Cannot open a session that is Closed" });
    const getVm = renderHook();
    await act(async () => {});

    await act(async () => {
        await getVm().startClass(getVm().todaysBlocks[0]);
    });

    // Must NOT silently proceed into WAITING with a dead session.
    expect(getVm().view).toBe("SELECT_SESSION");
    expect(getVm().session).toBeNull();
    expect(getVm().statusMessage).toBeTruthy();
    expect(connectBiometricSocket).not.toHaveBeenCalled();
});

test("Important #9: a failure partway through startClass surfaces via statusMessage, closes the socket it opened, and allows a retry", async () => {
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: isoWeekdayNow(), cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([]);
    schedulingApi.createSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Created" });
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    const fakeSocket = { send: jest.fn(), onAttendanceEvent: jest.fn(() => () => {}), onStatusChange: jest.fn(() => () => {}), close: jest.fn() };
    connectBiometricSocket.mockReturnValue(fakeSocket);
    cohortActorByPerson.mockRejectedValueOnce(new Error("referenceData unavailable"));
    const getVm = renderHook();
    await act(async () => {});

    await act(async () => {
        await getVm().startClass(getVm().todaysBlocks[0]);
    });

    // No unhandled rejection: the failure is surfaced, not swallowed.
    expect(getVm().view).toBe("SELECT_SESSION");
    expect(getVm().statusMessage).toBeTruthy();
    // The socket opened before the failure must be closed, not leaked.
    expect(fakeSocket.close).toHaveBeenCalledTimes(1);
    expect(getVm().socket).toBeNull();
});

test("Important #9: a second startClass() call while one is already in flight is a no-op", async () => {
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: isoWeekdayNow(), cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([]);
    let resolveCreateSession;
    schedulingApi.createSession.mockReturnValue(
        new Promise((resolve) => { resolveCreateSession = resolve; })
    );
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    const getVm = renderHook();
    await act(async () => {});

    let firstCall;
    let secondCall;
    await act(async () => {
        firstCall = getVm().startClass(getVm().todaysBlocks[0]);
        secondCall = getVm().startClass(getVm().todaysBlocks[0]); // should be a no-op
        resolveCreateSession({ classSessionId: 55, sessionStatus: "Created" });
        await Promise.all([firstCall, secondCall]);
    });

    expect(schedulingApi.createSession).toHaveBeenCalledTimes(1);
    expect(connectBiometricSocket).toHaveBeenCalledTimes(1);
});

function isoWeekdayNow() {
    return ((new Date().getDay() + 6) % 7) + 1;
}

describe("ending, cancelling and correcting a running class", () => {
    const block = { scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: ((new Date().getDay() + 6) % 7) + 1, cohortId: 10 };
    let socket;

    async function startedClass() {
        listBlocks.mockResolvedValue([block]);
        schedulingApi.listSessions.mockResolvedValue([
            { classSessionId: 55, scheduleBlockId: 1, sessionDate: todayLocalDate(), sessionStatus: "Open" },
        ]);
        schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
        attendanceApi.recordsBySession.mockResolvedValue([
            { academicActorId: 3, attendanceRecordId: 90, captureMethod: "FACIAL", attendanceStatus: "Present" },
        ]);
        socket = {
            send: jest.fn(),
            onAttendanceEvent: jest.fn(() => () => {}),
            onStatusChange: jest.fn(() => () => {}),
            close: jest.fn(),
        };
        connectBiometricSocket.mockReturnValue(socket);
        const getVm = renderHook();
        await act(async () => {});
        await act(async () => {
            await getVm().startClass(getVm().todaysBlocks[0]);
        });
        return getVm;
    }

    beforeEach(() => {
        schedulingApi.cancelSession = jest.fn();
        attendanceApi.updateRecord = jest.fn().mockResolvedValue({});
        attendanceApi.deleteRecord = jest.fn().mockResolvedValue({});
    });

    test("endClass keeps the class and its socket alive when the backend refuses to close it", async () => {
        const getVm = await startedClass();
        schedulingApi.closeSession.mockRejectedValue(new Error("boom"));

        await act(async () => {
            await expect(getVm().endClass()).rejects.toThrow("boom");
        });

        expect(socket.close).not.toHaveBeenCalled();
        expect(getVm().view).toBe("WAITING");
    });

    test("endClass closes the socket once the backend confirms", async () => {
        const getVm = await startedClass();
        schedulingApi.closeSession.mockResolvedValue({});

        await act(async () => {
            await getVm().endClass();
        });

        expect(socket.close).toHaveBeenCalledTimes(1);
        expect(getVm().view).toBe("SELECT_SESSION");
    });

    test("cancelClass closes the biometric socket and returns to the class list", async () => {
        const getVm = await startedClass();
        schedulingApi.cancelSession.mockResolvedValue({});
        let err;

        await act(async () => {
            err = await getVm().cancelClass();
        });

        expect(err).toBeNull();
        expect(socket.close).toHaveBeenCalledTimes(1);
        expect(getVm().view).toBe("SELECT_SESSION");
    });

    test("cancelClass reports the backend error and keeps the class running", async () => {
        const getVm = await startedClass();
        schedulingApi.cancelSession.mockRejectedValue(new Error("no se puede cancelar"));
        let err;

        await act(async () => {
            err = await getVm().cancelClass();
        });

        expect(err).toBe("no se puede cancelar");
        expect(socket.close).not.toHaveBeenCalled();
        expect(getVm().view).toBe("WAITING");
    });

    test("marking a student late is reflected locally and removing the record clears it", async () => {
        const getVm = await startedClass();
        expect(getVm().lateActorIds.has(3)).toBe(false);

        await act(async () => {
            await getVm().correctRecord(3, "Late");
        });
        expect(attendanceApi.updateRecord).toHaveBeenCalledWith(90, { attendanceStatus: "Late", captureMethod: "MANUAL" });
        expect(getVm().lateActorIds.has(3)).toBe(true);

        await act(async () => {
            await getVm().removeRecord(3);
        });
        expect(getVm().lateActorIds.has(3)).toBe(false);
    });
});
