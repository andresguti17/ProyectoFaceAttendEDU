// Panel e informes: las cifras salen de los datos reales (serie de sesiones y padrón), sin factores
// ni tendencias inventadas, y cada rol ve solo su alcance.
jest.mock("../../view/components/hooks/useTheme", () => {
    const theme = { colors: { brand: { primary: "#1" }, status: { success: "#s", warning: "#w", danger: "#d" }, text: { secondary: "#t", disabled: "#x" } } };
    const value = { theme };
    return { useTheme: () => value };
});
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => {
    const translation = { t: (k) => k };
    return { useTranslation: () => translation };
});
jest.mock("../../view/components/hooks/useDateFormat", () => {
    const value = { formatDate: () => "28/10/2026" };
    return { useDateFormat: () => value };
});
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../context/AppDataContext", () => ({ useAppData: jest.fn() }));
jest.mock("../../services/api/dashboardSeries", () => ({
    dashboardSeries: jest.fn(),
    instructorClassCounts: jest.fn(),
    recentActivity: jest.fn(),
}));
jest.mock("@react-navigation/native", () => {
    const navigation = { navigate: jest.fn() };
    return { useNavigation: () => navigation, __navigation: navigation };
});
jest.mock("../../services/api", () => ({ academicApi: { listSchools: jest.fn() } }));
jest.mock("../../services/api/attendanceApi", () => ({ attendanceApi: { recordsBySession: jest.fn() } }));
jest.mock("../../services/api/schedulingApi", () => ({ schedulingApi: { listSessions: jest.fn(), listEnvironments: jest.fn() } }));
jest.mock("../../services/api/reportNotifications", () => ({ notifyActors: jest.fn(), notifyStudentByActorId: jest.fn() }));
jest.mock("../../services/api/referenceData", () => ({
    listBlocks: jest.fn(),
    optional: (p, fallback) => Promise.resolve(p).catch(() => fallback),
}));
jest.mock("../../core/utils/exportHelpers", () => ({
    exportToExcel: jest.fn(async () => ({ success: true })),
    exportToPDF: jest.fn(() => ({ success: true })),
    buildReportHTML: jest.fn(() => "<html/>"),
    buildHTMLTable: jest.fn(() => "<table/>"),
    formatPercentageWithColor: jest.fn(),
    formatStatusBadge: jest.fn(),
}));

import { useAuth } from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import { dashboardSeries, instructorClassCounts, recentActivity } from "../../services/api/dashboardSeries";
import { academicApi } from "../../services/api";
import { attendanceApi } from "../../services/api/attendanceApi";
import { schedulingApi } from "../../services/api/schedulingApi";
import { listBlocks } from "../../services/api/referenceData";
import { notifyActors, notifyStudentByActorId } from "../../services/api/reportNotifications";
import { exportToExcel, exportToPDF } from "../../core/utils/exportHelpers";
import { saveInstitutionConfig, getDefaultInstitutionConfig } from "../../core/config/institutionConfig";
import { useDashboardViewModel } from "../useDashboardViewModel";
import { useReportsViewModel, REPORTS_PAGE_SIZE } from "../useReportsViewModel";
import { renderHook, flush, act } from "./support/renderHook";

const { __navigation: navigation } = jest.requireMock("@react-navigation/native");

const STUDENTS = [
    { id: "1", name: "Ana", code: "A1", course: "ADSO", ficha: "F1", status: "active", attendance: 95, personId: "p-1", courseIds: ["10"], cohortId: "5" },
    { id: "2", name: "Luis", code: "A2", course: "ADSO", ficha: "F1", status: "active", attendance: 60, personId: "p-2" },
    { id: "3", name: "Eva", code: "A3", course: "RED", ficha: "F2", status: "inactive", attendance: 80, personId: "p-3" },
];
const COURSES = [
    { id: "10", code: "ADSO", name: "Software", instructorActorIds: [50], avgAttendance: 77 },
    { id: "11", code: "RED", name: "Redes", instructorActorIds: [60], avgAttendance: 80 },
    { id: "12", code: "MAT", name: "Matemáticas", instructorActorIds: [], avgAttendance: 0 },
];
const SERIES = {
    daily: [{ day: "lun", present: 6, late: 2, absent: 2 }, { day: "mar", present: 8, late: 0, absent: 2 }],
    weekly: [{ week: "W1", rate: 80 }],
    meta: { sessionsToday: 3, sessionsClosedToday: 1 },
};

beforeEach(() => {
    jest.clearAllMocks();
    saveInstitutionConfig({ ...getDefaultInstitutionConfig(), minAttendance: 80 });
    useAppData.mockReturnValue({
        fichas: [{ code: "ADSO", instructorId: "u-5", totalStudents: 2, activeStudents: 2, avgAttendance: 77 }, { code: "RED" }],
        students: STUDENTS,
        teachers: [{ id: "t1", actorId: 50, name: "Iván" }],
        courses: COURSES,
        programs: [{ code: "ADSO", name: "Software" }],
        isLoading: false,
    });
    dashboardSeries.mockResolvedValue(SERIES);
    instructorClassCounts.mockResolvedValue(new Map([["50", { scheduled: 10, taught: 9 }]]));
    recentActivity.mockResolvedValue([{ id: 1 }]);
    schedulingApi.listSessions.mockResolvedValue([]);
    schedulingApi.listEnvironments.mockResolvedValue([]);
    listBlocks.mockResolvedValue([]);
    academicApi.listSchools.mockResolvedValue([]);
});

async function dashboard(user) {
    useAuth.mockReturnValue({ user });
    const hook = await renderHook(useDashboardViewModel);
    await flush(3);
    return hook.result;
}

describe("dashboard", () => {
    test("admin: today and punctuality come from the real series and no card shows an invented trend", async () => {
        const vm = await dashboard({ id: "u-9", role: "admin", schoolId: 2 });

        const byLabel = Object.fromEntries(vm().stats.map((s) => [s.label, s]));
        // Último día de la serie: 8 presentes de 10 registros.
        expect(byLabel["Asistencia hoy"]).toMatchObject({ value: "80.0%", subtitle: "8/10 estudiantes" });
        // De 16 que asistieron en la serie, 14 a tiempo.
        expect(byLabel["Tasa de puntualidad"].value).toBe("87.5%");
        expect(vm().stats.every((s) => s.change === undefined)).toBe(true);
        expect(vm().recentActivity).toEqual([{ id: 1 }]);
        expect(vm().adminData.instructorAttendance[0]).toMatchObject({ attendanceRate: 90 });
    });

    test("admin with an empty series shows zeros, not estimates", async () => {
        dashboardSeries.mockResolvedValue({ daily: [], weekly: [], meta: { sessionsToday: 0, sessionsClosedToday: 0 } });

        const vm = await dashboard({ id: "u-9", role: "admin", schoolId: 2 });

        const byLabel = Object.fromEntries(vm().stats.map((s) => [s.label, s]));
        expect(byLabel["Asistencia hoy"]).toMatchObject({ value: "0.0%", subtitle: "0/0 estudiantes" });
        expect(byLabel["Tasa de puntualidad"].value).toBe("0.0%");
    });

    test("teacher: its own courses only, not the first two of the school", async () => {
        const vm = await dashboard({ id: "u-5", role: "teacher", academicActorId: 50 });

        expect(vm().teacherData.myFichas.map((f) => f.code)).toEqual(["ADSO"]);
        expect(vm().courseAttendance.map((c) => c.course)).toEqual(["ADSO"]);
        const byLabel = Object.fromEntries(vm().stats.map((s) => [s.label, s]));
        expect(byLabel["Clases hoy"].value).toBe("1/3");
        expect(vm().stats.every((s) => s.change === undefined)).toBe(true);
        expect(dashboardSeries).toHaveBeenCalledWith(expect.objectContaining({ role: "teacher", instructorActorId: 50 }));
    });

    test("student: its own record, status of today from the series and its own courses", async () => {
        const vm = await dashboard({ id: "u-1", role: "student", personId: "p-1" });

        const byLabel = Object.fromEntries(vm().stats.map((s) => [s.label, s]));
        // Último día de la serie: 8 presentes, 0 tardanzas, 2 ausencias → presente.
        expect(byLabel["Estado hoy"].value).toBe("Presente");
        expect(byLabel["Mi asistencia"].value).toBe("95.0%");
        expect(byLabel["Mis cursos"].value).toBe(1);
        expect(vm().studentData.personalInfo.id).toBe("1");
        expect(dashboardSeries).toHaveBeenCalledWith(expect.objectContaining({ role: "student", academicActorId: 1, cohortId: "5" }));
        expect(recentActivity).not.toHaveBeenCalled();
    });

    test("a failing series leaves empty charts", async () => {
        dashboardSeries.mockRejectedValue(new Error("503"));

        const vm = await dashboard({ id: "u-9", role: "admin", schoolId: 2 });

        expect(vm().attendanceByDay).toEqual([]);
        expect(vm().attendanceByWeek).toEqual([]);
    });
});

async function reports(user, ...args) {
    useAuth.mockReturnValue({ user });
    const hook = await renderHook(() => useReportsViewModel(...args));
    await flush(3);
    return hook.result;
}

describe("reports", () => {
    test("the global rate is the real average of active learners for every period", async () => {
        const vm = await reports({ id: "u-9", role: "admin", schoolId: 2 });
        const rate = () => vm().stats[0].value;

        expect(rate()).toBe("78%"); // (95 + 60) / 2
        act(() => vm().setPeriod("week"));
        await flush();
        expect(rate()).toBe("78%");
        expect(vm().stats[0].change).toBeUndefined();
    });

    test("filters, search, sorting and pagination work on the roster", async () => {
        const vm = await reports({ id: "u-9", role: "admin", schoolId: 2 });

        expect(vm().filteredStudents.map((s) => s.id)).toEqual(["1", "2"]); // estado activo por defecto
        expect(vm().filteredStudents[0].courseName).toBe("Software");
        act(() => vm().setStatusFilter("all"));
        act(() => vm().setSortBy("attendance-asc"));
        expect(vm().filteredStudents.map((s) => s.id)).toEqual(["2", "3", "1"]);
        act(() => vm().setSearch("eva"));
        expect(vm().filteredStudents.map((s) => s.id)).toEqual(["3"]);
        expect(vm()).toMatchObject({ totalPages: 1, pageSize: REPORTS_PAGE_SIZE, page: 0 });
    });

    test("at-risk mode keeps only learners under the threshold", async () => {
        const vm = await reports({ id: "u-9", role: "admin", schoolId: 2 }, "at-risk", null, null, 80);

        expect(vm().filteredStudents.map((s) => s.id)).toEqual(["2"]);
        expect(vm().atRiskStudents.map((s) => s.id)).toEqual(["2"]);
    });

    test("the attendance series counts only sessions of the instructor's blocks", async () => {
        const today = new Date().toISOString().slice(0, 10);
        schedulingApi.listSessions.mockResolvedValue([
            { classSessionId: 1, scheduleBlockId: 7, sessionDate: today },
            { classSessionId: 2, scheduleBlockId: 8, sessionDate: today },
            { classSessionId: 3, scheduleBlockId: 7, sessionDate: today, sessionStatus: "Cancelled" },
        ]);
        listBlocks.mockResolvedValue([{ scheduleBlockId: 7, instructorActorId: 50 }, { scheduleBlockId: 8, instructorActorId: 60 }]);
        attendanceApi.recordsBySession.mockResolvedValue([
            { attendanceStatus: "Present" }, { attendanceStatus: "Justified" }, { attendanceStatus: "Late" }, { attendanceStatus: "Absent" },
        ]);

        const vm = await reports({ id: "u-5", role: "teacher", academicActorId: 50 });

        expect(attendanceApi.recordsBySession).toHaveBeenCalledTimes(1);
        expect(attendanceApi.recordsBySession).toHaveBeenCalledWith(1);
        expect(vm().attendanceByDay[0]).toMatchObject({ date: today, present: 2, late: 1, absent: 1 });
        expect(vm().attendanceByWeek[0].rate).toBe(50);
    });

    test("notifications report success and failure", async () => {
        notifyActors.mockResolvedValueOnce({ sent: 2 }).mockRejectedValueOnce(new Error("403"));
        notifyStudentByActorId.mockResolvedValueOnce(undefined);
        const vm = await reports({ id: "u-9", role: "admin", schoolId: 2 });

        await act(async () => vm().notifyAll());
        expect(vm().notifyState).toEqual({ sending: false, error: null, sent: 2 });
        await act(async () => vm().notifyAll());
        expect(vm().notifyState.error).toBe("403");
        await act(async () => vm().notifyStudent("1"));
        expect(vm().notifyState.sent).toBe(1);
    });

    test("exports build the sheets and the PDF with the real period label", async () => {
        const vm = await reports({ id: "u-9", role: "admin", schoolId: 2 });

        await act(async () => vm().exportExcel());
        const [sheets, filename] = exportToExcel.mock.calls[0];
        expect(sheets.map((s) => s.name)).toEqual(["Aprendices", "Evolución Semanal", "Ranking Programas"]);
        expect(sheets[0].data).toHaveLength(2);
        expect(filename).toBe("Reporte_Asistencia_Semestre.xlsx");

        act(() => vm().exportPDF());
        expect(exportToPDF).toHaveBeenCalledWith("<html/>", "Reporte_Semestre");
    });

    test("details and history navigate to the right tabs", async () => {
        const vm = await reports({ id: "u-9", role: "admin", schoolId: 2 });

        act(() => vm().viewStudentDetails("1"));
        act(() => vm().viewFullHistory());

        expect(navigation.navigate).toHaveBeenCalledWith("Users", { section: "students", searchQuery: "A1" });
        expect(navigation.navigate).toHaveBeenCalledWith("History");
    });

    test("the super admin gets one summary per school", async () => {
        academicApi.listSchools.mockResolvedValue([{ schoolId: 2, name: "Norte" }]);
        useAppData.mockReturnValue({
            fichas: [], courses: [], programs: [], isLoading: false,
            students: [{ id: "1", schoolId: "2", status: "active", attendance: 90, name: "A" }, { id: "2", schoolId: null, status: "active", attendance: 50, name: "B" }],
        });

        const vm = await reports({ id: "u-0", role: "admin", schoolId: null, roles: ["Super Administrador"] });

        expect(vm().schoolSummaries.map((s) => [s.name, s.total, s.atRisk])).toEqual([["Norte", 1, 0], ["Sin sede", 1, 1]]);
    });
});
