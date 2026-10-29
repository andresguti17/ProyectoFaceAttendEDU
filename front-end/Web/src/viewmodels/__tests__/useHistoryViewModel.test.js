// HU-HIST-001: historial de asistencia acotado por rol, cruzado con sesión, bloque, ficha y ambiente.
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../context/AppDataContext", () => ({ useAppData: jest.fn() }));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => {
    const translation = { t: (k) => k };
    return { useTranslation: () => translation };
});
jest.mock("../../services/api", () => ({
    attendanceApi: { recordsByActor: jest.fn() },
    schedulingApi: { listSessions: jest.fn() },
}));
jest.mock("../../services/api/referenceData", () => ({
    listBlocks: jest.fn(), listCohorts: jest.fn(), listEnvironments: jest.fn(), personMap: jest.fn(), actorMap: jest.fn(),
    optional: (p, fallback) => Promise.resolve(p).catch(() => fallback),
}));

import { useAuth } from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import { attendanceApi, schedulingApi } from "../../services/api";
import { listBlocks, listCohorts, listEnvironments, personMap, actorMap } from "../../services/api/referenceData";
import { useHistoryViewModel, PAGE_SIZE } from "../useHistoryViewModel";
import { renderHook, flush, act } from "./support/renderHook";

const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

const STUDENTS = [
    { id: "100", name: "Ana", personId: "p-100", cohortId: "5", courseIds: ["10"], ficha: "F-5" },
    { id: "101", name: "Luis", personId: "p-101", cohortId: "6", courseIds: ["10"], ficha: "F-6" },
];
// El docente 50 dicta el curso 10 solo en la ficha 5; la ficha 6 lo ve con otro docente.
const COURSES = [{ id: "10", name: "Bases de datos", instructorActorIds: [50, 60], instructorCohortIds: { 50: ["5"], 60: ["6"] } }];

beforeEach(() => {
    jest.clearAllMocks();
    useAppData.mockReturnValue({ students: STUDENTS, courses: COURSES });
    schedulingApi.listSessions.mockResolvedValue([
        { classSessionId: 70, scheduleBlockId: 7, sessionDate: today },
        { classSessionId: 71, scheduleBlockId: 7, sessionDate: "2020-01-01" },
    ]);
    listBlocks.mockResolvedValue([
        { scheduleBlockId: 7, cohortId: 5, courseId: 10, environmentId: 4, instructorActorId: 50 },
        { scheduleBlockId: 8, cohortId: 6, courseId: 10, environmentId: 4, instructorActorId: 60 },
    ]);
    listCohorts.mockResolvedValue([{ cohortId: 5, code: "F-5" }, { cohortId: 6, code: "F-6" }]);
    listEnvironments.mockResolvedValue([{ environmentId: 4, name: "Sala 1" }]);
    actorMap.mockResolvedValue(new Map([[50, { personId: "p-50", actorCode: "I-50" }], [60, { actorCode: "I-60" }]]));
    personMap.mockResolvedValue(new Map([["p-50", { name: "Iván", lastName: "Ruiz" }]]));
    attendanceApi.recordsByActor.mockImplementation(async (id) =>
        id === 100
            ? [
                { attendanceRecordId: 1, classSessionId: 70, attendanceStatus: "Late", captureMethod: "FACIAL", capturedAt: `${today}T07:20:00Z` },
                { attendanceRecordId: 2, classSessionId: 71, attendanceStatus: "Absent", captureMethod: "MANUAL" },
            ]
            : []);
});

async function load(user) {
    useAuth.mockReturnValue({ user });
    const hook = await renderHook(useHistoryViewModel);
    await flush(2);
    return hook.result;
}

test("an instructor's scope is the learners of its own cohorts, as the backend scopes it", async () => {
    const vm = await load({ role: "teacher", academicActorId: 50 });

    expect(vm().scope.kind).toBe("teacher");
    expect(vm().scope.students.map((s) => s.id)).toEqual(["100"]);
    expect(vm().personOptions).toEqual([{ value: "100", label: "Ana" }]);
    expect(vm().cohortOptions).toEqual([{ value: "5", label: "F-5" }]);
    expect(vm().instructorOptions).toEqual([{ value: "50", label: "Iván Ruiz" }]);
});

test("the query joins each record with its session, block, room and instructor", async () => {
    const vm = await load({ role: "teacher", academicActorId: 50 });

    await act(async () => vm().runQuery());

    expect(attendanceApi.recordsByActor).toHaveBeenCalledWith(100);
    expect(vm().hasQueried).toBe(true);
    expect(vm().rows[0]).toMatchObject({
        recordId: 1, personName: "Ana", date: today, time: "07:20", status: "Late", cohort: "F-5",
        course: "Bases de datos", environment: "Sala 1", instructor: "Iván Ruiz",
    });
    expect(vm().stats).toEqual({ total: 2, present: 0, absent: 1, late: 1, justified: 0 });
});

test("status, period and room filters apply to the joined rows", async () => {
    const vm = await load({ role: "admin", schoolId: 2 });
    await act(async () => vm().runQuery());
    expect(vm().rows).toHaveLength(2);

    act(() => vm().setFilter("status", "Absent"));
    expect(vm().rows.map((r) => r.recordId)).toEqual([2]);
    act(() => vm().setFilter("status", ""));
    act(() => vm().setFilter("period", "today"));
    expect(vm().rows.map((r) => r.recordId)).toEqual([1]);
    act(() => vm().setFilter("environmentId", "999"));
    expect(vm().rows).toEqual([]);

    act(() => vm().resetFilters());
    expect(vm().rows).toHaveLength(2);
    expect(vm()).toMatchObject({ page: 0, pageCount: 1 });
    expect(PAGE_SIZE).toBe(20);
});

test("a learner only sees its own record and gets a notice when it is not in the roster", async () => {
    const vm = await load({ role: "student", personId: "p-100" });
    expect(vm().scope.students.map((s) => s.id)).toEqual(["100"]);
    expect(vm().cohortOptions).toEqual([]);

    const stranger = await load({ role: "student", personId: "p-999" });
    await act(async () => stranger().runQuery());
    expect(stranger().notice).toBe("No hay personas en tu alcance con esos filtros.");
    expect(attendanceApi.recordsByActor).not.toHaveBeenCalled();
});

test("an admin narrowing by person only queries that person", async () => {
    const vm = await load({ role: "admin", schoolId: null });
    expect(vm().scope.label).toBe("Asistencia registrada");

    act(() => vm().setFilter("personId", "101"));
    await act(async () => vm().runQuery());

    expect(attendanceApi.recordsByActor.mock.calls.map(([id]) => id)).toEqual([101]);
});

test("too many people is refused before querying", async () => {
    useAppData.mockReturnValue({
        students: Array.from({ length: 51 }, (_, i) => ({ id: String(i), name: `P${i}`, cohortId: "5" })),
        courses: COURSES,
    });
    const vm = await load({ role: "admin", schoolId: 2 });

    await act(async () => vm().runQuery());

    expect(vm().error).toMatch(/máximo de personas/);
    expect(attendanceApi.recordsByActor).not.toHaveBeenCalled();
});

test("a person whose records fail still lets the rest of the query finish", async () => {
    attendanceApi.recordsByActor.mockImplementation(async (id) => {
        if (id === 101) throw new Error("403");
        return [{ attendanceRecordId: 9, classSessionId: 70, attendanceStatus: "Present" }];
    });
    const vm = await load({ role: "admin", schoolId: 2 });

    await act(async () => vm().runQuery());

    expect(vm().rows.map((r) => r.recordId)).toEqual([9]);
    expect(vm().error).toBeNull();
});
