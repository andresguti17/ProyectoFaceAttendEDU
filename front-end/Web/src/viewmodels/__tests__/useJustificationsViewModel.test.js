// HU-JUS-001 (el aprendiz radica) y HU-JUS-002 (instructor/admin revisan) en la web.
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../context/AppDataContext", () => ({ useAppData: jest.fn() }));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => {
    const translation = { t: (k) => k };
    return { useTranslation: () => translation };
});
jest.mock("../../services/api", () => ({
    attendanceApi: {
        listJustificationTypes: jest.fn(), listJustifications: jest.fn(), recordsByActor: jest.fn(), recordsBySession: jest.fn(),
        getRecord: jest.fn(), createJustification: jest.fn(), uploadJustificationDocument: jest.fn(), deleteJustification: jest.fn(),
        justificationDocuments: jest.fn(), reviewJustification: jest.fn(), supportingDocumentContent: jest.fn(),
    },
    schedulingApi: { listSessions: jest.fn(), listEnvironments: jest.fn() },
}));
jest.mock("../../services/api/referenceData", () => ({
    listBlocks: jest.fn(),
    actorMap: jest.fn(),
    personMap: jest.fn(),
    optional: (promise, fallback) => Promise.resolve(promise).catch(() => fallback),
}));
jest.mock("../../services/api/notificationApi", () => ({ notificationApi: { createAlert: jest.fn(), listAlertTypes: jest.fn(), createAlertType: jest.fn() } }));

import { useAuth } from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import { attendanceApi, schedulingApi } from "../../services/api";
import { listBlocks, actorMap, personMap } from "../../services/api/referenceData";
import { notificationApi } from "../../services/api/notificationApi";
import { useJustificationsViewModel, MAX_DOC_BYTES } from "../useJustificationsViewModel";
import { renderHook, flush, act } from "./support/renderHook";

const STUDENT = { id: "u-1", role: "student", academicActorId: 10, schoolId: 2 };
const ADMIN = { id: "u-9", role: "admin", schoolId: 2, roles: ["Administrador"] };
const TEACHER = { id: "u-5", role: "teacher", academicActorId: 50, schoolId: 2 };

const RECORDS = [
    { attendanceRecordId: 1, classSessionId: 70, academicActorId: 10, attendanceStatus: "Absent" },
    { attendanceRecordId: 2, classSessionId: 71, academicActorId: 10, attendanceStatus: "Late", capturedAt: "2026-10-22T13:20:00Z" },
    { attendanceRecordId: 3, classSessionId: 72, academicActorId: 10, attendanceStatus: "Present" },
    { attendanceRecordId: 4, classSessionId: 73, academicActorId: 10, attendanceStatus: "Absent" },
];
const JUSTIFICATIONS = [
    { justificationId: 40, attendanceRecordId: 4, reviewStatus: "Pending", submittedAt: "2026-10-23T10:00:00Z", justificationTypeId: 1 },
    { justificationId: 41, attendanceRecordId: 99, reviewStatus: "Approved", submittedAt: "2026-10-20T10:00:00Z" },
];

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    useAppData.mockReturnValue({ courses: [], students: [] });
    attendanceApi.listJustificationTypes.mockResolvedValue([{ justificationTypeId: 1, name: "Médica" }, { justificationTypeId: 2, name: "Vieja", status: false }]);
    attendanceApi.listJustifications.mockResolvedValue(JUSTIFICATIONS);
    attendanceApi.recordsByActor.mockResolvedValue(RECORDS);
    schedulingApi.listSessions.mockResolvedValue([
        { classSessionId: 70, sessionDate: "2026-10-21", scheduleBlockId: 7 },
        { classSessionId: 73, sessionDate: "2026-10-23", scheduleBlockId: 8 },
    ]);
    schedulingApi.listEnvironments.mockResolvedValue([]);
    listBlocks.mockResolvedValue([{ scheduleBlockId: 7, instructorActorId: 50 }, { scheduleBlockId: 8, instructorActorId: 60 }]);
    actorMap.mockResolvedValue(new Map([[10, { personId: "p-10", actorCode: "A-10" }], [11, { actorCode: "A-11" }]]));
    personMap.mockResolvedValue(new Map([["p-10", { name: "Ana", lastName: "Pérez" }]]));
});

async function load(user) {
    useAuth.mockReturnValue({ user });
    const hook = await renderHook(useJustificationsViewModel);
    await flush(3);
    return hook.result;
}

describe("learner", () => {
    test("lists its own requests and the absences and lates it can still justify", async () => {
        const vm = await load(STUDENT);

        expect(vm()).toMatchObject({ mode: "submit", isReviewer: false });
        expect(vm().types.map((t) => t.name)).toEqual(["Médica"]);
        expect(vm().myJustifications.map((j) => [j.justificationId, j.date])).toEqual([[40, "2026-10-23"]]);
        // El 4 ya tiene justificación y el 3 es una asistencia: quedan 2 (sesión) y 1.
        expect(vm().eligibleRecords.map((r) => [r.attendanceRecordId, r.date])).toEqual([[2, "2026-10-22"], [1, "2026-10-21"]]);
    });

    test("the reason, a new record and a valid support are required", async () => {
        const vm = await load(STUDENT);
        const submit = async (args) => {
            let ok;
            await act(async () => {
                ok = await vm().submit(args);
            });
            return ok;
        };

        act(() => vm().openSubmit(RECORDS[0]));
        expect(await submit({ typeId: 1, reason: "  " })).toBe(false);
        expect(vm().feedback.message).toBe("El motivo de la justificación es obligatorio.");

        expect(await submit({ typeId: 1, reason: "Cita", file: { name: "virus.exe" } })).toBe(false);
        expect(vm().feedback.message).toMatch(/Formato no válido/);

        expect(await submit({ typeId: 1, reason: "Cita", file: { name: "a.pdf", size: MAX_DOC_BYTES + 1 } })).toBe(false);
        expect(vm().feedback.message).toMatch(/5 MB/);

        act(() => vm().openSubmit(RECORDS[3]));
        expect(await submit({ typeId: 1, reason: "Cita" })).toBe(false);
        expect(vm().feedback.message).toMatch(/ya tiene una justificación/);
        expect(attendanceApi.createJustification).not.toHaveBeenCalled();
    });

    test("a request is filed and its support uploaded to MinIO through attendance", async () => {
        attendanceApi.createJustification.mockResolvedValue({ justificationId: 50 });
        const vm = await load(STUDENT);
        act(() => vm().openSubmit(RECORDS[0]));
        const file = { name: "cita.PDF", size: 1000, file: new Blob(["x"]) };

        let ok;
        await act(async () => {
            ok = await vm().submit({ typeId: "1", reason: " Cita médica ", file });
        });

        expect(ok).toBe(true);
        expect(attendanceApi.createJustification).toHaveBeenCalledWith({ attendanceRecordId: 1, justificationTypeId: 1, reason: "Cita médica" });
        expect(attendanceApi.uploadJustificationDocument).toHaveBeenCalledWith(50, file.file, "cita.PDF");
        expect(vm()).toMatchObject({ submitOpen: false, listTab: "mine", feedback: { type: "success" } });
    });

    test("a failed upload says the request was filed without its support", async () => {
        attendanceApi.createJustification.mockResolvedValue({ justificationId: 50 });
        attendanceApi.uploadJustificationDocument.mockRejectedValue(new Error("413"));
        const vm = await load(STUDENT);
        act(() => vm().openSubmit(RECORDS[0]));

        await act(async () => {
            await vm().submit({ typeId: 1, reason: "Cita", file: { name: "a.png", file: new Blob(["x"]) } });
        });

        expect(vm().feedback).toEqual({ type: "error", message: expect.stringContaining("413") });
        expect(vm().submitOpen).toBe(false);
    });

    test("a 403 explains the missing permission", async () => {
        attendanceApi.createJustification.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
        const vm = await load(STUDENT);
        act(() => vm().openSubmit(RECORDS[0]));

        await act(async () => {
            await vm().submit({ typeId: 1, reason: "Cita" });
        });

        expect(vm().feedback.message).toMatch(/permiso/);
    });

    test("only a pending request can be withdrawn", async () => {
        const vm = await load(STUDENT);
        act(() => vm().askWithdraw({ reviewStatus: "Approved" }));
        expect(vm().withdrawOpen).toBe(false);

        act(() => vm().askWithdraw(vm().myJustifications[0]));
        await act(async () => vm().confirmWithdraw());

        expect(attendanceApi.deleteJustification).toHaveBeenCalledWith(40);
        expect(vm().feedback).toEqual({ type: "success", message: "Justificación retirada." });
    });
});

describe("reviewer", () => {
    beforeEach(() => {
        attendanceApi.getRecord.mockImplementation(async (id) => (id === 4 ? { attendanceRecordId: 4, academicActorId: 10, classSessionId: 73, attendanceStatus: "Absent" } : null));
        attendanceApi.justificationDocuments.mockResolvedValue([]);
    });

    test("an admin sees the school requests with the learner name; records it cannot read are dropped", async () => {
        const vm = await load(ADMIN);

        expect(vm()).toMatchObject({ mode: "review", pendingCount: 1, resolvedCount: 0, truncated: false });
        expect(vm().reviewRows.map((r) => [r.justificationId, r.personName, r.date])).toEqual([[40, "Ana Pérez", "2026-10-23"]]);
        act(() => vm().setReviewTab("resolved"));
        expect(vm().reviewRows).toEqual([]);
    });

    test("an instructor only sees requests from sessions of its own blocks", async () => {
        attendanceApi.recordsBySession.mockImplementation(async (id) =>
            id === 70 ? [{ attendanceRecordId: 4, academicActorId: 10, classSessionId: 70, attendanceStatus: "Absent" }] : []);
        useAppData.mockReturnValue({
            courses: [{ instructorCohortIds: { 50: ["5"] } }],
            students: [{ id: "10", cohortId: 5 }, { id: "11", cohortId: 6 }],
        });

        const vm = await load(TEACHER);

        expect(attendanceApi.recordsBySession).toHaveBeenCalledWith(70);
        expect(attendanceApi.recordsBySession).not.toHaveBeenCalledWith(73);
        expect(vm().reviewRows.map((r) => r.justificationId)).toEqual([40]);
    });

    test("approving needs a support; the review is saved and no alert is created from the browser", async () => {
        const vm = await load(ADMIN);
        await act(async () => vm().openDetail(vm().reviewRows[0]));
        act(() => vm().askDecision("Approved"));
        expect(vm().feedback.message).toMatch(/no tiene soporte/);
        expect(vm().confirmOpen).toBe(false);

        attendanceApi.justificationDocuments.mockResolvedValue([{ supportingDocumentId: 9 }]);
        await act(async () => vm().openDetail(vm().reviewRows[0]));
        act(() => vm().askDecision("Approved"));
        act(() => vm().setNotes("  Soporte válido "));
        await act(async () => vm().confirmReview());

        expect(attendanceApi.reviewJustification).toHaveBeenCalledWith(40, { reviewStatus: "Approved", reviewedBy: "u-9", resolutionNotes: "Soporte válido" });
        // Regresión: notification crea la alerta al consumir attendance.justification.events.
        expect(notificationApi.createAlert).not.toHaveBeenCalled();
        expect(vm().feedback.type).toBe("success");
        expect(vm().detail).toBeNull();
    });

    test("a review the backend rejects is reported", async () => {
        attendanceApi.reviewJustification.mockRejectedValue(new Error("La justificación ya fue revisada"));
        const vm = await load(ADMIN);
        await act(async () => vm().openDetail(vm().reviewRows[0]));
        act(() => vm().askDecision("Rejected"));

        await act(async () => vm().confirmReview());

        expect(vm().feedback).toEqual({ type: "error", message: "La justificación ya fue revisada" });
        expect(vm().isReviewing).toBe(false);
    });

    test("a support saved before real uploads explains why it has no content", async () => {
        attendanceApi.supportingDocumentContent.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
        const close = jest.fn();
        jest.spyOn(window, "open").mockReturnValue({ close });
        const vm = await load(ADMIN);

        await act(async () => vm().openDocument({ supportingDocumentId: 9 }));

        expect(close).toHaveBeenCalled();
        expect(vm().feedback.message).toMatch(/no tiene contenido/);
    });
});
