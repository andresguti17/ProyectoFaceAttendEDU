// ============================================================
//  Regresión: el Dashboard dejaba la pantalla en blanco para
//  Instructor y Aprendiz porque `thresholds` solo se declaraba
//  dentro de las métricas del administrador.
// ============================================================

import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUser = { id: "u-1", role: "student", personId: "p-1", academicActorId: 10, schoolId: 2 };

const mockColors = new Proxy({}, { get: () => new Proxy({}, { get: () => "#000" }) });

jest.mock("../../view/components/hooks/useTheme", () => ({
    useTheme: () => ({ theme: { colors: mockColors } }),
}));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));
jest.mock("../../view/components/hooks/useDateFormat", () => ({
    useDateFormat: () => ({ formatDate: () => "01/01/2026" }),
}));
const mockAuth = { user: mockUser };
jest.mock("../../context/AuthContext", () => ({ useAuth: () => mockAuth }));

// Referencias estables: el hook las usa como dependencias de efectos y memos.
const mockAppData = {
    isLoading: false,
    teachers: [],
    fichas: [
        {
            id: "25",
            code: "3145556",
            instructorId: "u-1",
            totalStudents: 23,
            activeStudents: 23,
            avgAttendance: 90,
        },
    ],
    courses: [{ id: "1", code: "MAT", name: "Matemáticas", credits: 3 }],
    students: [
        {
            id: "1829",
            personId: "p-1",
            name: "Ana García",
            attendance: 91,
            course: "MAT",
            courseId: "1",
            courseIds: ["1"],
            cohortId: "25",
            status: "active",
        },
    ],
};
jest.mock("../../context/AppDataContext", () => ({ useAppData: () => mockAppData }));
jest.mock("../../services/api/dashboardSeries", () => ({
    dashboardSeries: jest.fn(() =>
        Promise.resolve({ daily: [], weekly: [], meta: { sessionsToday: 0, sessionsClosedToday: 0 } })
    ),
    recentActivity: jest.fn(() => Promise.resolve([])),
}));

import { useDashboardViewModel } from "../useDashboardViewModel";

function renderVm() {
    let vm;
    function Probe() {
        vm = useDashboardViewModel();
        return null;
    }
    act(() => {
        create(<Probe />);
    });
    return () => vm;
}

test.each(["student", "teacher"])("%s dashboard builds its stats without throwing", async (role) => {
    mockUser.role = role;
    let getVm;
    await act(async () => {
        getVm = renderVm();
    });
    const vm = getVm();
    expect(Array.isArray(vm.stats)).toBe(true);
    expect(vm.stats.length).toBeGreaterThan(0);
});
