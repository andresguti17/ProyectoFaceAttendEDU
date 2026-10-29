// AppDataContext: carga por sesión acotada a la sede, cargas parciales que no tumban la pantalla,
// banderas biométricas reales y operaciones que mantienen la lista en memoria al día.
import React from "react";
import { create, act } from "react-test-renderer";

jest.mock("../AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/api/biometricCaptureApi", () => ({ biometricCaptureApi: { summaryAll: jest.fn() } }));
jest.mock("../../services/api/settingsPersistence", () => ({ syncInstitutionConfigFromBackend: jest.fn(async () => true) }));
jest.mock("../../services/api/referenceData", () => ({ resetReferenceData: jest.fn(), setActiveSchool: jest.fn(), setUsersListAllowed: jest.fn() }));
jest.mock("../../models/data/StudentStorage", () => ({
    loadStudents: jest.fn(), saveStudents: jest.fn(),
    addStudent: jest.fn(async (list, d) => [...list, { id: "s_new", ...d }]),
    addStudentsBulk: jest.fn(async (list, ds) => [...list, ...ds.map((d, i) => ({ id: `s_${i}`, ...d }))]),
}));
jest.mock("../../models/data/UserStorage", () => ({
    loadUsers: jest.fn(),
    addUser: jest.fn(async (list, d) => [...list, { id: "usr_new", ...d }]),
    updateUser: jest.fn(async (list, id, p) => list.map((u) => (u.id === id ? { ...u, ...p } : u))),
    deleteUser: jest.fn(async (list, id) => list.filter((u) => u.id !== id)),
}));
jest.mock("../../models/data/EnvironmentStorage", () => ({
    loadEnvironments: jest.fn(),
    addEnvironment: jest.fn(async (list, d) => [...list, { id: "env_new", schedules: [], ...d }]),
    updateEnvironment: jest.fn(async (list, id, p) => list.map((e) => (e.id === id ? { ...e, ...p } : e))),
    deleteEnvironment: jest.fn(async (list, id) => list.filter((e) => e.id !== id)),
    addScheduleToEnvironment: jest.fn(async (list, envId, d) => list.map((e) => (e.id === envId ? { ...e, schedules: [...e.schedules, d] } : e))),
    updateSchedule: jest.fn(async (list) => list),
    deleteSchedule: jest.fn(async (list, envId, sid) => list.map((e) => (e.id === envId ? { ...e, schedules: e.schedules.filter((s) => s.id !== sid) } : e))),
}));
jest.mock("../../models/data/FichaStorage", () => ({
    loadFichas: jest.fn(),
    addFicha: jest.fn(async (list, d) => [...list, { id: "f_new", ...d }]),
    updateFicha: jest.fn(async (list, id, p) => list.map((f) => (f.id === id ? { ...f, ...p } : f))),
    deleteFicha: jest.fn(async (list, id) => list.filter((f) => f.id !== id)),
}));
jest.mock("../../models/data/CourseStorage", () => ({
    loadCourses: jest.fn(),
    addCourse: jest.fn(async (list, d) => [...list, { id: "course_new", ...d }]),
    updateCourse: jest.fn(async (list, id, p) => list.map((c) => (c.id === id ? { ...c, ...p } : c))),
    deleteCourse: jest.fn(async (list, id) => list.filter((c) => c.id !== id)),
}));

import { useAuth } from "../AuthContext";
import { biometricCaptureApi } from "../../services/api/biometricCaptureApi";
import { resetReferenceData, setActiveSchool, setUsersListAllowed } from "../../services/api/referenceData";
import { loadStudents, saveStudents } from "../../models/data/StudentStorage";
import { loadUsers } from "../../models/data/UserStorage";
import { loadEnvironments } from "../../models/data/EnvironmentStorage";
import { loadFichas } from "../../models/data/FichaStorage";
import { loadCourses } from "../../models/data/CourseStorage";
import { AppDataProvider, useAppData } from "../AppDataContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STUDENTS = [
    { id: "100", personId: "p-100", course: "BD", courseId: "10", status: "active", attendance: 90 },
    { id: "101", personId: "p-101", course: "BD", courseId: "10", status: "inactive", attendance: 50 },
    { id: "102", personId: null, course: "", status: "active", attendance: 0 },
];
const USERS = [
    { id: "u-200", personId: "p-200", role: "teacher", name: "Iván" },
    { id: "u-9", personId: "p-9", role: "admin", name: "Admin" },
];

let latest;
function Probe() {
    latest = useAppData();
    return null;
}

async function mount(user) {
    useAuth.mockReturnValue({ user, isLoadingAuth: false });
    let renderer;
    await act(async () => {
        renderer = create(<AppDataProvider><Probe /></AppDataProvider>);
    });
    // Promesas de carga + revelado progresivo (12 tandas de 150 ms).
    for (let i = 0; i < 5; i += 1) {
        await act(async () => {
            await jest.advanceTimersByTimeAsync(400);
        });
    }
    return { vm: () => latest, renderer };
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    loadUsers.mockResolvedValue(USERS);
    loadEnvironments.mockResolvedValue([{ id: "4", number: "B-101", schedules: [] }]);
    loadFichas.mockResolvedValue([{ id: "5", code: "F-5" }]);
    loadCourses.mockResolvedValue([{ id: "10", code: "BD", name: "Bases de datos", startDate: "2026-01-01", endDate: "2027-12-31" }]);
    loadStudents.mockResolvedValue(STUDENTS);
    biometricCaptureApi.summaryAll.mockResolvedValue({ face_person_ids: ["p-100", "p-200"], fingerprint_person_ids: ["p-100"] });
});

afterEach(() => jest.useRealTimers());

test("an admin session loads the school's data, the users list and the real biometric flags", async () => {
    const { vm } = await mount({ role: "admin", schoolId: 2 });

    expect(setActiveSchool).toHaveBeenCalledWith(2);
    expect(setUsersListAllowed).toHaveBeenCalledWith(true);
    expect(vm().isLoading).toBe(false);
    expect(vm().loadError).toBeNull();
    expect(vm().students.map((s) => [s.id, s.hasFacial, s.hasFingerprint])).toEqual([["100", true, true], ["101", false, false], ["102", undefined, undefined]]);
    expect(vm().teachers).toEqual([expect.objectContaining({ id: "u-200", grade: "Docente", hasFacial: true })]);
    expect(vm().admins).toEqual([expect.objectContaining({ id: "u-9", grade: "Administrador" })]);
    // El aprendiz hereda el período de su curso por id.
    expect(vm().students[0].grade).not.toBe("—");
    expect(vm().courses[0].currentPeriod).toBeTruthy();
    expect(vm().programs).toEqual([{ name: "Bases de datos", code: "BD", studentCount: 2, avgAttendance: 70, activeCount: 1 }]);
});

test("instructors and learners never request the users list", async () => {
    const { vm } = await mount({ role: "teacher", schoolId: 2 });

    expect(loadUsers).not.toHaveBeenCalled();
    expect(setUsersListAllowed).toHaveBeenCalledWith(false);
    expect(vm().users).toEqual([]);
    expect(vm().students).toHaveLength(3);
});

test("one failing load shows its error but keeps the rest of the data", async () => {
    loadFichas.mockRejectedValue(new Error("cohorts 503"));
    biometricCaptureApi.summaryAll.mockRejectedValue(new Error("403"));

    const { vm } = await mount({ role: "admin", schoolId: 2 });

    expect(vm().loadError).toBe("cohorts 503");
    expect(vm().fichas).toEqual([]);
    expect(vm().environments).toHaveLength(1);
    expect(vm().students[0].hasFacial).toBeUndefined(); // sin banderas, como llegaron
});

test("a failing learner list is reported without hiding staff", async () => {
    loadStudents.mockRejectedValue(new Error("summary timeout"));

    const { vm } = await mount({ role: "admin", schoolId: 2 });

    expect(vm().loadError).toBe("summary timeout");
    expect(vm().teachers).toHaveLength(1);
});

test("without a session nothing is loaded and the reference cache is dropped", async () => {
    const { vm } = await mount(null);

    expect(resetReferenceData).toHaveBeenCalled();
    expect(loadCourses).not.toHaveBeenCalled();
    expect(vm().students).toEqual([]);
});

test("write helpers keep the lists in memory in sync", async () => {
    const { vm } = await mount({ role: "admin", schoolId: 2 });

    await act(async () => vm().addEnvironment({ number: "L-1" }));
    await act(async () => vm().updateEnvironment("4", { number: "B-102" }));
    await act(async () => vm().addSchedule("4", { id: "s1" }));
    await act(async () => vm().removeSchedule("4", "s1"));
    await act(async () => vm().updateSchedule("4", "s1", {}));
    await act(async () => vm().removeEnvironment("env_new"));
    expect(vm().environments).toEqual([{ id: "4", number: "B-102", schedules: [] }]);

    await act(async () => vm().addFicha({ code: "F-NEW" }));
    await act(async () => vm().updateFicha("5", { code: "F-5b" }));
    await act(async () => vm().removeFicha("f_new"));
    expect(vm().fichas).toEqual([{ id: "5", code: "F-5b" }]);

    await act(async () => vm().addCourse({ code: "LOC" }));
    await act(async () => vm().updateCourse("10", { name: "BD I" }));
    await act(async () => vm().removeCourse("course_new"));
    expect(vm().courses.map((c) => c.name)).toEqual(["BD I"]);

    await act(async () => vm().addUser({ name: "Local" }));
    await act(async () => vm().updateUser("u-9", { name: "Admin 2" }));
    await act(async () => vm().removeUser("usr_new"));
    expect(vm().users.map((u) => u.name)).toEqual(["Iván", "Admin 2"]);

    await act(async () => vm().updateStudent("100", { attendance: 95 }));
    expect(saveStudents).toHaveBeenCalled();
    expect(vm().students.find((s) => s.id === "100").attendance).toBe(95);
    await act(async () => vm().removeStudent("102"));
    expect(vm().students.map((s) => s.id)).toEqual(["100", "101"]);
    await act(async () => vm().addStudent({ name: "Nuevo", course: "BD" }));
    expect(vm().students.some((s) => s.id === "s_new")).toBe(true);
    await act(async () => {
        expect(await vm().importStudents([])).toBe(0);
        expect(await vm().importStudents([{ name: "A" }, { name: "B" }])).toBe(2);
    });

    act(() => vm().patchStaff("teacher", "u-200", { name: "Iván R." }));
    act(() => vm().patchBiometrics("p-101", { hasFacial: true }));
    expect(vm().teachers[0].name).toBe("Iván R.");
    act(() => vm().patchStaff("student", "100", { code: "A-100" }));
    act(() => vm().patchStaff("admin", "u-9", { name: "Root" }));
    expect(vm().admins[0].name).toBe("Root");
});

test("reloads replace the lists with the backend's", async () => {
    const { vm } = await mount({ role: "admin", schoolId: 2 });
    loadCourses.mockResolvedValue([{ id: "11", code: "RED", name: "Redes" }]);
    loadUsers.mockResolvedValue([USERS[0]]);
    loadStudents.mockResolvedValue([STUDENTS[0]]);

    await act(async () => vm().reloadCourses());
    await act(async () => vm().reloadUsers());
    await act(async () => vm().reloadStudents());
    await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
    });

    expect(vm().courses.map((c) => c.id)).toEqual(["11"]);
    expect(vm().users).toHaveLength(1);
    expect(vm().students.map((s) => s.id)).toEqual(["100"]);
});

test("useAppData outside its provider fails loudly", () => {
    function Orphan() {
        useAppData();
        return null;
    }
    expect(() => act(() => { create(<Orphan />); })).toThrow(/AppDataProvider/);
});
