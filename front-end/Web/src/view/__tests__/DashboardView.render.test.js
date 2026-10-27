import React from "react";
import { create, act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../../context/ThemeContext";
import { ResponsiveProvider } from "../../context/ResponsiveContext";
import DashboardView from "../DashboardView";

// Icon fonts cannot load under jest; the icon keeps its name/size/color in the tree.
jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}:${props.size}:${props.color}` }));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

// Charts and lists have their own tests: here they render as named elements
// so the snapshot pins exactly what each panel passes them.
let mockWeekState = {};
jest.mock("../components/dashboard", () => {
    const stub = (name) => (props) => require("react").createElement(name, props);
    return {
        DailyBarChart: stub("DailyBarChart"),
        WeeklyTrend: stub("WeeklyTrend"),
        WeeklyAttendanceView: stub("WeeklyAttendanceView"),
        InstructorAttendanceList: stub("InstructorAttendanceList"),
        TopPerformingGroups: stub("TopPerformingGroups"),
        AtRiskStudentsList: stub("AtRiskStudentsList"),
        PerfectAttendanceList: stub("PerfectAttendanceList"),
        useWeeklyAttendanceController: () => ({
            selectedWeek: null,
            handleWeekSelect: () => {},
            handleResetToCurrentWeek: () => {},
            weeklyTrendProps: { data: "weeks" },
            dailyBarChartProps: { data: "days" },
            currentWeekNumber: 7,
            isCurrentWeek: false,
            ...mockWeekState,
        }),
    };
});

let mockVm = {};
jest.mock("../../viewmodels/useDashboardViewModel", () => ({ useDashboardViewModel: () => mockVm }));
jest.mock("../../viewmodels/useRolePermissions", () => ({ useRolePermissions: () => ({ canRegisterFace: true }) }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const METRICS = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function render() {
    let root;
    act(() => {
        root = create(
            <SafeAreaProvider initialMetrics={METRICS}>
                <ThemeProvider><ResponsiveProvider><DashboardView /></ResponsiveProvider></ThemeProvider>
            </SafeAreaProvider>,
        );
    });
    return root;
}

const BASE = {
    isLoading: false,
    todayLabel: "Lunes",
    stats: [
        { label: "Estudiantes", value: 120, icon: "users", color: "#123456", change: 5, subtitle: "activos" },
        { label: "Asistencia", value: "88%", icon: "check", color: "#654321", change: -2 },
        { label: "Fichas", value: 8, icon: "book", color: "#abcdef" },
    ],
    attendanceByWeek: [{ week: "Sem 6", rate: 90 }],
    attendanceByDay: [{ day: "Lun", rate: 80 }],
    courseAttendance: [
        { course: "c1", courseName: "ADSI 2758", rate: 92, barColor: "#00aa00" },
        { course: "c2", courseName: "Redes 2760", rate: 64, barColor: "#aa0000" },
    ],
    recentActivity: [
        { id: 1, student: "Ana", course: "ADSI", time: "08:00", status: "present" },
        { id: 2, student: "Luis", course: "Redes", time: "08:10", status: "late" },
    ],
};

const ROLES = {
    admin: {
        adminData: {
            atRiskStudents: [{ id: "s1" }],
            perfectAttendanceStudents: [{ id: "s2" }],
            fichas: [{ id: "f1" }],
            instructorAttendance: [{ id: "i1" }],
        },
    },
    teacher: { teacherData: { myFichas: [{ id: "f1" }], myAtRiskStudents: [{ id: "s1" }] } },
    student: { studentData: { name: "Ana" } },
};

describe("DashboardView render", () => {
    beforeEach(() => {
        mockWeekState = {};
    });

    test.each(Object.keys(ROLES))("%s panel", (role) => {
        mockVm = { ...BASE, userRole: role, ...ROLES[role] };
        expect(render().toJSON()).toMatchSnapshot();
    });

    test.each(Object.keys(ROLES))("%s panel on the current week", (role) => {
        mockWeekState = { isCurrentWeek: true };
        mockVm = { ...BASE, userRole: role, ...ROLES[role] };
        expect(render().toJSON()).toMatchSnapshot();
    });

    test.each(Object.keys(ROLES))("%s panel while its data loads", (role) => {
        mockVm = { ...BASE, userRole: role, isLoading: true };
        expect(render().toJSON()).toMatchSnapshot();
    });
});
