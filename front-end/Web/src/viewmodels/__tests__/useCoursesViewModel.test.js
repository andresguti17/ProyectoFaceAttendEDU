// Cursos (HU-SCH-001, FR 8.1): validación, filtros, "mis cursos" por rol y CRUD contra ms-academic.
jest.mock("../../context/AppDataContext", () => ({ useAppData: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/api/courseCreation", () => ({
    createCourse: jest.fn(), updateCourse: jest.fn(), deleteCourse: jest.fn(), importCourses: jest.fn(),
}));

import { useAppData } from "../../context/AppDataContext";
import { useAuth } from "../../context/AuthContext";
import { createCourse, updateCourse, deleteCourse, importCourses } from "../../services/api/courseCreation";
import { saveInstitutionConfig, getDefaultInstitutionConfig } from "../../core/config/institutionConfig";
import { useCoursesViewModel, validateCourseForm, parseCreditHours, EMPTY_COURSE_FORM } from "../useCoursesViewModel";
import { renderHook, act } from "./support/renderHook";

const COURSES = [
    { id: "10", code: "BD", name: "Bases de datos", professor: "Iván", students: 20, avgAttendance: 90, status: "active", programId: 3, instructorActorIds: [50] },
    { id: "11", code: "RED", name: "Redes", professor: "Sara", students: 15, avgAttendance: 70, status: "inactive", programId: 3, instructorActorIds: [60] },
    { id: "12", code: "ALG", name: "Algoritmos", professor: null, students: 30, avgAttendance: 80, status: "completed", programId: 3 },
];
const STUDENTS = [
    { id: "1", personId: "p-1", course: "BD", courseIds: ["10", "11"], status: "active", attendance: 90 },
    { id: "2", personId: "p-2", course: "BD", courseIds: ["10"], status: "active", attendance: 50 },
    { id: "3", personId: "p-3", course: "RED", status: "inactive", attendance: 40 },
];

let appData;
beforeEach(() => {
    jest.resetAllMocks();
    saveInstitutionConfig({ ...getDefaultInstitutionConfig(), minAttendance: 80 });
    appData = { courses: COURSES, students: STUDENTS, isLoading: false, reloadCourses: jest.fn(), updateCourse: jest.fn() };
    useAppData.mockReturnValue(appData);
    useAuth.mockReturnValue({ user: { role: "admin", schoolId: 2 } });
});

async function vm() {
    return (await renderHook(useCoursesViewModel)).result;
}

test("form validation and credit hours", () => {
    const base = { ...EMPTY_COURSE_FORM, code: "BD", name: "Bases", programId: "3" };
    expect(validateCourseForm({ ...base, name: " " })).toBe("El nombre es requerido");
    expect(validateCourseForm({ ...base, programId: "" })).toBe("El programa es requerido");
    expect(validateCourseForm({ ...base, creditHours: "-1" })).toMatch(/créditos/);
    expect(validateCourseForm({ ...base, creditHours: "40000" })).toMatch(/créditos/);
    expect(validateCourseForm({ ...base, code: "" })).toBe("El código es requerido");
    expect(validateCourseForm({ ...base, creditHours: "4" })).toBeNull();
    expect([parseCreditHours(""), parseCreditHours("3"), parseCreditHours("3.5"), parseCreditHours("40000")]).toEqual([null, 3, null, null]);
});

test("stats count active learners of the listed courses and those at risk", async () => {
    const v = await vm();

    expect(v().stats).toEqual({ total: 3, active: 1, completed: 1, totalStudents: 2, avgAttendance: 70, alertCount: 1 });
    expect(v().instructors.map((i) => i.value)).toEqual(["Iván", "Sara"]);
});

test("search, instructor, status and advanced filters combine", async () => {
    const v = await vm();

    act(() => v().setSearch("iván"));
    expect(v().filtered.map((c) => c.id)).toEqual(["10"]);
    act(() => v().setSearch(""));
    act(() => v().setInstructorFilter("Sara"));
    expect(v().filtered.map((c) => c.id)).toEqual(["11"]);
    act(() => v().setInstructorFilter(""));
    act(() => v().setStatusFilter("completed"));
    expect(v().filtered.map((c) => c.id)).toEqual(["12"]);
    act(() => v().setStatusFilter(""));

    act(() => v().setAdvancedFilterColumn("attendance"));
    act(() => v().setAttendanceFilter({ mode: "custom", comparator: "gt", percentage: 75 }));
    expect(v().filtered.map((c) => c.id)).toEqual(["10", "12"]);
    act(() => v().setAttendanceFilter({ mode: "preset", comparator: "lt", percentage: null }));
    expect(v().filtered.map((c) => c.id)).toEqual(["11", "12", "10"]);

    act(() => v().setAdvancedFilterColumn("students"));
    act(() => v().setAdvancedFilterValue("desc"));
    expect(v().filtered.map((c) => c.id)).toEqual(["12", "10", "11"]);
    act(() => v().setAdvancedFilterColumn("instructor"));
    act(() => v().setAdvancedFilterValue("asc"));
    expect(v().filtered[0].id).toBe("12"); // sin instructor primero
    act(() => v().setAdvancedFilterColumn("status"));
    act(() => v().setAdvancedFilterValue("inactive"));
    expect(v().filtered.map((c) => c.id)).toEqual(["11"]);
    act(() => v().clearAdvancedFilter());
    expect(v().filtered).toHaveLength(3);
});

test("a teacher's courses are those where it has blocks; a learner's, those of its cohort", async () => {
    useAuth.mockReturnValue({ user: { role: "teacher", academicActorId: 50 } });
    let v = await vm();
    expect(v().myCourses.map((c) => c.id)).toEqual(["10"]);
    // Dos aprendices únicos en BD (el 1 también está en RED, no se cuenta dos veces).
    expect(v().myStats).toEqual({ total: 1, totalStudents: 2, avgAttendance: 70, alertCount: 0 });

    useAuth.mockReturnValue({ user: { role: "student", personId: "p-1" } });
    v = await vm();
    expect(v().myCourses.map((c) => c.id)).toEqual(["10", "11"]);
    act(() => v().setSearch("red"));
    expect(v().myFiltered.map((c) => c.id)).toEqual(["11"]);
});

test("nothing is listed while the roster is still loading", async () => {
    useAppData.mockReturnValue({ ...appData, isLoading: true });
    const v = await vm();
    expect(v().courses).toEqual([]);
});

test("creating a course goes to the backend and reloads the real list", async () => {
    const v = await vm();
    const form = { ...EMPTY_COURSE_FORM, code: " NEW ", name: " Nuevo ", programId: "3", creditHours: "4" };

    expect(await v().registerCourse({ ...form, name: "" })).toBe("El nombre es requerido");
    await act(async () => {
        expect(await v().registerCourse(form)).toBeNull();
    });
    expect(createCourse).toHaveBeenCalledWith({ programId: "3", code: "NEW", name: "Nuevo", creditHours: 4 });
    expect(appData.reloadCourses).toHaveBeenCalled();

    createCourse.mockRejectedValue(new Error("Código repetido"));
    expect(await v().registerCourse(form)).toBe("Código repetido");
});

test("editing patches the course in the backend and in memory", async () => {
    const v = await vm();
    expect(await v().editCourse({ ...EMPTY_COURSE_FORM, code: "X", name: "Y", programId: "3" })).toBe("No hay curso seleccionado");

    act(() => v().openEditModal(COURSES[0]));
    await act(async () => v().editCourse({ ...EMPTY_COURSE_FORM, code: "BD2", name: "BD II", programId: "3", creditHours: "" }));

    expect(updateCourse).toHaveBeenCalledWith(10, { programId: "3", code: "BD2", name: "BD II", creditHours: null });
    expect(appData.updateCourse).toHaveBeenCalledWith("10", { programId: "3", code: "BD2", name: "BD II" });

    updateCourse.mockRejectedValue(new Error("403"));
    expect(await v().editCourse({ ...EMPTY_COURSE_FORM, code: "BD2", name: "BD II", programId: "3" })).toBe("403");
});

test("toggling the status sends the opposite state", async () => {
    const v = await vm();

    await act(async () => v().toggleCourseStatus(COURSES[0]));
    expect(updateCourse).toHaveBeenCalledWith(10, expect.objectContaining({ status: false }));
    expect(appData.updateCourse).toHaveBeenCalledWith("10", { status: "inactive" });

    expect(await v().toggleCourseStatus({ id: "9" })).toBe("El curso no tiene programa asociado");
    expect(await v().toggleCourseStatus(null)).toBe("Falta el curso");
});

test("deleting and importing", async () => {
    importCourses.mockResolvedValueOnce({ success: 2, errors: [] }).mockRejectedValueOnce(new Error("timeout"));
    const v = await vm();
    act(() => v().selectCourse(COURSES[1]));

    await act(async () => v().removeCourse(COURSES[1]));
    expect(deleteCourse).toHaveBeenCalledWith("11");
    expect(v().selected).toBeNull();
    expect(await v().removeCourse({})).toBe("Falta el curso a eliminar");

    expect(await v().importCourses([{ code: "A" }])).toEqual({ success: 2, errors: [] });
    expect(importCourses).toHaveBeenCalledWith(2, [{ code: "A" }]);
    expect(await v().importCourses([])).toEqual({ success: 0, errors: [{ course: "", reason: "timeout" }] });
});
