jest.mock("../../../api/apiClient", () => ({
    fetchAllPages: jest.fn(),
}));
jest.mock("../attendanceApi", () => ({
    attendanceApi: { recordsBySession: jest.fn(), recordsByActor: jest.fn() },
}));
jest.mock("../referenceData", () => ({
    actorMap: jest.fn(),
    courseMap: jest.fn(),
    listActors: jest.fn(),
    listBlocks: jest.fn(),
    personMap: jest.fn(),
}));

import { fetchAllPages } from "../../../api/apiClient";
import { attendanceApi } from "../attendanceApi";
import { actorMap, courseMap, listBlocks, personMap } from "../referenceData";
import { dashboardSeries, recentActivity } from "../dashboardSeries";

function isoDaysAgo(n) {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date.toISOString().slice(0, 10);
}

beforeEach(() => {
    jest.clearAllMocks();
    listBlocks.mockResolvedValue([
        { scheduleBlockId: 501, courseId: 12, instructorActorId: 601 },
    ]);
});

test("builds daily buckets from session records", async () => {
    fetchAllPages.mockResolvedValue([
        { classSessionId: 1, scheduleBlockId: 501, sessionDate: isoDaysAgo(1) },
        { classSessionId: 2, scheduleBlockId: 501, sessionDate: isoDaysAgo(2) },
    ]);
    attendanceApi.recordsBySession.mockImplementation(async (id) =>
        id === 1
            ? [
                  { attendanceRecordId: 1, attendanceStatus: "Present" },
                  { attendanceRecordId: 2, attendanceStatus: "Late" },
                  { attendanceRecordId: 3, attendanceStatus: "Absent" },
              ]
            : [{ attendanceRecordId: 4, attendanceStatus: "Justified" }]
    );

    const { daily, weekly } = await dashboardSeries({ role: "admin" });

    expect(daily).toHaveLength(2);
    expect(daily[0]).toMatchObject({ present: 1, late: 0, absent: 0 });
    expect(daily[1]).toMatchObject({ present: 1, late: 1, absent: 1 });
    expect(weekly.length).toBeGreaterThan(0);
    expect(weekly[0].week).toMatch(/^Sem \d+$/);
    expect(weekly[0]).toHaveProperty("rate");
    expect(weekly[0].dailyData).toHaveLength(daily.length);
});

test("teacher scope keeps only their blocks", async () => {
    fetchAllPages.mockResolvedValue([
        { classSessionId: 1, scheduleBlockId: 501, sessionDate: isoDaysAgo(1) },
        { classSessionId: 2, scheduleBlockId: 999, sessionDate: isoDaysAgo(1) },
    ]);
    attendanceApi.recordsBySession.mockResolvedValue([
        { attendanceRecordId: 1, attendanceStatus: "Present" },
    ]);

    const { daily } = await dashboardSeries({ role: "teacher", instructorActorId: 601 });

    // Una sola sesión (la del bloque propio) aporta registros.
    const total = daily.reduce((sum, d) => sum + d.present, 0);
    expect(total).toBe(1);
    expect(attendanceApi.recordsBySession).toHaveBeenCalledTimes(1);
});

test("student scope buckets their own records by date", async () => {
    attendanceApi.recordsByActor.mockResolvedValue([
        { attendanceRecordId: 1, attendanceStatus: "Present", capturedAt: `${isoDaysAgo(1)}T08:00:00Z` },
        { attendanceRecordId: 2, attendanceStatus: "Absent", capturedAt: `${isoDaysAgo(3)}T08:00:00Z` },
    ]);

    const { daily } = await dashboardSeries({ role: "student", academicActorId: 77 });

    expect(attendanceApi.recordsByActor).toHaveBeenCalledWith(77);
    expect(daily).toHaveLength(2);
    // Las sesiones solo alimentan la meta (clases de hoy de su ficha).
    expect(fetchAllPages).toHaveBeenCalled();
});

test("recent activity joins actor, person and course", async () => {
    fetchAllPages.mockResolvedValue([
        { classSessionId: 1, scheduleBlockId: 501, sessionDate: isoDaysAgo(0) },
    ]);
    attendanceApi.recordsBySession.mockResolvedValue([
        {
            attendanceRecordId: 10,
            academicActorId: 601,
            attendanceStatus: "Late",
            capturedAt: new Date(Date.now() - 5 * 60000).toISOString(),
        },
    ]);
    actorMap.mockResolvedValue(new Map([[601, { academicActorId: 601, personId: "p-1" }]]));
    personMap.mockResolvedValue(new Map([["p-1", { personId: "p-1", name: "Ana", lastName: "López" }]]));
    courseMap.mockResolvedValue(new Map([[12, { courseId: 12, code: "MAT" }]]));

    const items = await recentActivity({ limit: 5 });

    expect(items).toEqual([
        { id: "10", status: "late", student: "Ana López", course: "MAT", time: "Hace 5 min" },
    ]);
});

test("fetches every session in scope", async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
        classSessionId: 100 + i,
        scheduleBlockId: 501,
        sessionDate: isoDaysAgo(i + 1),
    }));
    fetchAllPages.mockResolvedValue(sessions);
    attendanceApi.recordsBySession.mockResolvedValue([
        { attendanceRecordId: 1, attendanceStatus: "Present" },
    ]);

    const { daily } = await dashboardSeries({ role: "admin" });

    expect(attendanceApi.recordsBySession).toHaveBeenCalledTimes(10);
    expect(daily).toHaveLength(10);
});

test("empty backend means empty series, never invented figures", async () => {
    fetchAllPages.mockResolvedValue([]);
    attendanceApi.recordsByActor.mockResolvedValue([]);

    const admin = await dashboardSeries({ role: "admin" });
    const student = await dashboardSeries({ role: "student", academicActorId: 1 });

    expect(admin.daily).toEqual([]);
    expect(admin.weekly).toEqual([]);
    expect(admin.meta).toEqual({ sessionsToday: 0, sessionsClosedToday: 0 });
    expect(student.daily).toEqual([]);
    await expect(recentActivity()).resolves.toEqual([]);
});
