import React from "react";
import { create, act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../../../../context/ThemeContext";
import { ResponsiveProvider } from "../../../../context/ResponsiveContext";
import { AdminReports } from "../AdminReports";

// Icon fonts cannot load under jest; the icon keeps its name/size/color in the tree.
jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}:${props.size}:${props.color}` }));
jest.mock("../sections", () => ({ HistoricosSection: () => null }));

const mockStudents = [];
jest.mock("../../../../context/AppDataContext", () => ({
    useAppData: () => ({ students: mockStudents, isLoading: false }),
}));

// The at-risk rows come straight from the fixture; thresholds stay real.
const mockAtRisk = [];
jest.mock("../../../../models/data/userDerivedData", () => ({
    ...jest.requireActual("../../../../models/data/userDerivedData"),
    getAtRiskStudents: () => mockAtRisk,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const METRICS = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function render(element) {
    let root;
    act(() => {
        root = create(
            <SafeAreaProvider initialMetrics={METRICS}>
                <ThemeProvider><ResponsiveProvider>{element}</ResponsiveProvider></ThemeProvider>
            </SafeAreaProvider>,
        );
    });
    return root;
}

const atRisk = (studentId, extra) => ({
    studentId,
    name: `Estudiante ${studentId}`,
    code: `C-${studentId}`,
    ficha: "f1",
    fichaName: "ADSI 2758",
    attendanceRate: 76,
    totalAbsences: 4,
    consecutiveAbsences: 0,
    daysUntilSanction: 12,
    hasExceededConsecutiveDays: false,
    lastAttendance: "hace 2 días",
    ...extra,
});

// One row per risk message: consecutive days, sanction reached, days left,
// below minimum, and the generic follow-up fallback.
const ROWS = [
    atRisk(1, { attendanceRate: 50, consecutiveAbsences: 4, hasExceededConsecutiveDays: true }),
    atRisk(2, { attendanceRate: 65, daysUntilSanction: 0 }),
    atRisk(3, { attendanceRate: 78, daysUntilSanction: 3, consecutiveAbsences: 2 }),
    atRisk(4, { attendanceRate: 75.5 }),
    atRisk(5, { attendanceRate: 85, lastAttendance: undefined }),
];

describe("AdminReports at-risk view render", () => {
    beforeEach(() => {
        mockStudents.length = 0;
        mockAtRisk.length = 0;
    });

    test("every risk message and row style", () => {
        mockAtRisk.push(...ROWS);
        mockStudents.push(...ROWS.map((r) => ({ id: r.studentId })));
        expect(render(<AdminReports />).toJSON()).toMatchSnapshot();
    });

    test("empty state", () => {
        expect(render(<AdminReports />).toJSON()).toMatchSnapshot();
    });
});
