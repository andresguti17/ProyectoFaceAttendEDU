// Capa de datos de la web sobre un backend simulado coherente (una sede): qué rutas se piden,
// cómo se acota todo a la sede activa y cómo se derivan cursos, fichas, aprendices, usuarios y
// ambientes de los datos reales.
jest.mock("../../../api/apiClient", () => ({ fetchAllPages: jest.fn(), request: jest.fn() }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAllPages, request } from "../../../api/apiClient";
import {
    optional, resetReferenceData, setActiveSchool, getActiveSchool, setUsersListAllowed, listUsers, listBlocks,
    cohortRoster, cohortActorByPerson, instructorCourseNamesByPerson, programMap, rolesForUser,
    fullName, normalizeStatus, hhmm, dayLabel,
} from "../../../services/api/referenceData";
import { loadCourses, addCourse, updateCourse, deleteCourse } from "../CourseStorage";
import { loadFichas, addFicha, updateFicha, deleteFicha } from "../FichaStorage";
import { loadStudents, addStudent, addStudentsBulk } from "../StudentStorage";
import { loadEnvironments, addEnvironment, updateEnvironment, deleteEnvironment, addScheduleToEnvironment, updateSchedule, deleteSchedule } from "../EnvironmentStorage";
import { loadUsers, addUser, updateUser, deleteUser } from "../UserStorage";

const DATA = {
    "/api/v1/schools/2/programs": [{ programId: 3, code: "ADSO", name: "Software" }],
    "/api/v1/programs/3/cohorts": [{ cohortId: 5, programId: 3, code: "F-2901", status: true }, { cohortId: 6, programId: 3, code: "F-OLD", status: false }],
    "/api/v1/programs/3/courses": [{ courseId: 10, programId: 3, code: "BD", name: "Bases de datos", status: true }],
    "/api/v1/cohorts/5/enrollments": [
        { enrollmentId: 1, cohortId: 5, academicActorId: 100, enrollmentStatus: "Active" },
        { enrollmentId: 2, cohortId: 5, academicActorId: 101, enrollmentStatus: "Withdrawn" },
    ],
    "/api/v1/cohorts/6/enrollments": [{ enrollmentId: 3, cohortId: 6, academicActorId: 102, enrollmentStatus: "Completed" }],
    "/api/v1/schools/2/actors": [
        { academicActorId: 100, personId: "p-100", actorTypeId: 1, schoolId: 2, actorCode: "A-100", status: true },
        { academicActorId: 101, personId: "p-101", actorTypeId: 1, schoolId: 2, actorCode: "A-101", status: false },
        { academicActorId: 102, personId: "p-102", actorTypeId: 1, schoolId: 2, actorCode: "A-102", status: true },
        { academicActorId: 200, personId: "p-200", actorTypeId: 2, schoolId: 2, actorCode: "I-200", status: true },
    ],
    "/api/v1/actor-types": [{ actorTypeId: 1, code: "STUDENT" }, { actorTypeId: 2, code: "INSTRUCTOR" }],
    "/api/v1/persons": [
        { personId: "p-100", name: "Ana", lastName: "Pérez", email: "ana@x.co", documentNumber: "1", birthDate: "2000-02-01T00:00:00Z" },
        { personId: "p-101", name: "Luis", lastName: "Gil" },
        { personId: "p-102", name: "Eva", lastName: "Ríos" },
        { personId: "p-200", name: "Iván", lastName: "Ruiz" },
    ],
    "/api/v1/users": [
        { userId: "u-100", personId: "p-100", username: "ana", status: true },
        { userId: "u-200", personId: "p-200", username: "ivan", status: true },
    ],
    "/api/v1/schedule-blocks": [
        { scheduleBlockId: 7, cohortId: 5, courseId: 10, environmentId: 4, instructorActorId: 200, dayOfWeek: 2, startsAt: "07:00:00", endsAt: "09:00:00" },
        { scheduleBlockId: 9, cohortId: 99, courseId: 10, environmentId: 4, instructorActorId: 200, dayOfWeek: 3 },
    ],
};

beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await AsyncStorage.clear();
    resetReferenceData();
    setActiveSchool(null);
    setActiveSchool(2);
    setUsersListAllowed(true);
    fetchAllPages.mockImplementation(async (path) => {
        if (!(path in DATA)) throw new Error(`no route ${path}`);
        return DATA[path];
    });
    request.mockImplementation(async (path, opts = {}) => {
        if (path === "/api/v1/environments") return [{ environmentId: 4, code: "B-101", name: "Sala 1", capacity: 30, status: true }];
        if (path === "/api/v1/attendance-records/summary") {
            return { 100: { present: 8, late: 1, absent: 1, justified: 0, total: 10 }, 101: { present: 1, late: 0, absent: 1, justified: 0, total: 2 } };
        }
        if (path === "/api/v1/user-roles") return { "u-100": [{ roleName: "Aprendiz" }], "u-200": [{ roleName: "Instructor" }] };
        if (path.startsWith("/api/v1/users/")) return [{ roleName: "Instructor" }];
        throw new Error(`no route ${path} ${JSON.stringify(opts)}`);
    });
});

describe("referenceData", () => {
    test("everything is scoped to the active school and each collection is fetched once", async () => {
        expect(getActiveSchool()).toBe(2);
        await Promise.all([loadCourses(), loadFichas(), loadStudents()]);

        const paths = fetchAllPages.mock.calls.map(([p]) => p);
        expect(paths).not.toContain("/api/v1/academic-actors");
        expect(paths).not.toContain("/api/v1/courses");
        expect(paths.filter((p) => p === "/api/v1/schools/2/actors")).toHaveLength(1);
        expect(paths.filter((p) => p === "/api/v1/programs/3/cohorts")).toHaveLength(1);
        // Bloques de cohortes de otra sede quedan fuera.
        expect((await listBlocks()).map((b) => b.scheduleBlockId)).toEqual([7]);
    });

    test("users are not listed for a role that cannot see them", async () => {
        setUsersListAllowed(false);
        await expect(listUsers()).resolves.toEqual([]);
        expect(fetchAllPages).not.toHaveBeenCalledWith("/api/v1/users", {}, { by: "page" });
    });

    test("a failed load is not cached", async () => {
        fetchAllPages.mockRejectedValueOnce(new Error("503"));
        await expect(programMap()).rejects.toThrow("503");
        await expect(programMap()).resolves.toBeInstanceOf(Map);
    });

    test("cohort roster, person→actor map and instructor courses", async () => {
        await expect(cohortRoster(5)).resolves.toEqual([
            { academicActorId: 100, personId: "p-100", name: "Ana Pérez" },
            { academicActorId: 101, personId: "p-101", name: "Luis Gil" },
        ]);
        expect((await cohortActorByPerson(5)).get("p-100")).toBe(100);
        expect((await instructorCourseNamesByPerson()).get("p-200")).toEqual(["Bases de datos"]);
        await expect(rolesForUser("u-200")).resolves.toEqual([{ roleName: "Instructor" }]);
    });

    test("format helpers and optional()", async () => {
        expect(fullName({ name: "Ana", lastName: "Pérez" })).toBe("Ana Pérez");
        expect(fullName(null)).toBe("");
        expect([normalizeStatus(true), normalizeStatus(false), normalizeStatus("Active"), normalizeStatus(undefined)]).toEqual(["active", "inactive", "active", "active"]);
        expect(hhmm("07:30:00")).toBe("07:30");
        expect(hhmm(null)).toBe("");
        expect([dayLabel(1), dayLabel(7), dayLabel(null)]).toEqual(["Lun", "Dom", "Lun"]);
        await expect(optional(Promise.reject(new Error("x")), "fallback")).resolves.toBe("fallback");
    });
});

describe("storages", () => {
    test("courses: learners of active cohorts, instructors, days, room and average attendance", async () => {
        const [course] = await loadCourses();

        expect(course).toMatchObject({
            id: "10", code: "BD", name: "Bases de datos", professor: "Iván Ruiz", instructorActorIds: [200],
            instructorCohortIds: { 200: ["5"] }, students: 1, schedule: "Mar", room: "B-101", avgAttendance: 90, status: "active",
        });
    });

    test("fichas: enrollments, instructor and attendance per cohort", async () => {
        const fichas = await loadFichas();
        const f = fichas.find((x) => x.id === "5");

        expect(f).toMatchObject({ code: "F-2901", name: "Software", program: "ADSO", instructor: "Iván Ruiz", instructorId: "u-200", totalStudents: 1, activeStudents: 1, avgAttendance: 90 });
        expect(f.color).toBeTruthy();
        expect(fichas.find((x) => x.id === "6")).toMatchObject({ status: "inactive", totalStudents: 1, avgAttendance: 0 });
    });

    test("students: only learner actors, with real attendance and its counts", async () => {
        const students = await loadStudents();
        const ana = students.find((s) => s.id === "100");

        expect(students.map((s) => s.id).sort()).toEqual(["100", "101", "102"]);
        expect(ana).toMatchObject({
            name: "Ana Pérez", code: "A-100", schoolId: "2", course: "BD", courseId: "10", courseIds: ["10"], cohortId: "5",
            attendance: 90, attendanceCounts: { present: 8, late: 1, absent: 1, justified: 0, total: 10 }, ficha: "F-2901",
            username: "ana", birthDate: "2000-02-01", status: "active",
        });
        // El retirado no queda en la ficha; sin registros, 0 % y sin conteos.
        expect(students.find((s) => s.id === "101")).toMatchObject({ cohortId: null, status: "inactive", attendance: 50 });
        expect(students.find((s) => s.id === "102")).toMatchObject({ attendance: 0, attendanceCounts: null });
    });

    test("students fail loudly when the backend has no STUDENT actor type", async () => {
        fetchAllPages.mockImplementation(async (path) => (path === "/api/v1/actor-types" ? [] : DATA[path]));
        await expect(loadStudents()).rejects.toThrow("STUDENT");
    });

    test("users: accounts tied to an actor of the school, with roles in one batch", async () => {
        const users = await loadUsers();

        expect(users.map((u) => [u.id, u.role, u.actorCode])).toEqual([["u-100", "student", "A-100"], ["u-200", "teacher", "I-200"]]);
        expect(users[1]).toMatchObject({ course: "Bases de datos", schoolId: "2", code: "ivan" });
        expect(request).toHaveBeenCalledWith("/api/v1/user-roles", { method: "GET", query: { userIds: "u-100,u-200" } });
    });

    test("users fall back to one role request per account when the batch endpoint fails", async () => {
        request.mockImplementation(async (path) => {
            if (path === "/api/v1/user-roles") throw new Error("404");
            if (path.startsWith("/api/v1/users/")) return [{ roleName: "Instructor" }];
            return {};
        });

        const users = await loadUsers();

        expect(users.every((u) => u.role === "teacher")).toBe(true);
        expect(request).toHaveBeenCalledWith("/api/v1/users/u-100/roles", { method: "GET" });
    });

    test("environments: rooms of the school with their schedule blocks", async () => {
        const [room] = await loadEnvironments();

        expect(room).toMatchObject({ id: "4", number: "B-101", name: "Sala 1", capacity: 30, status: "active" });
        expect(room.schedules[0]).toMatchObject({ id: "7", courseCode: "BD", instructor: "u-200", instructorName: "Iván Ruiz", startTime: "07:00", endTime: "09:00", days: ["Mar"] });
        expect(request).toHaveBeenCalledWith("/api/v1/environments", { method: "GET", query: { schoolId: 2 } });
    });

    test("a backend failure is surfaced, not replaced with demo data", async () => {
        fetchAllPages.mockRejectedValue(new Error("503"));
        request.mockRejectedValue(new Error("503"));

        await expect(loadCourses()).rejects.toThrow("503");
        await expect(loadFichas()).rejects.toThrow("503");
        await expect(loadEnvironments()).rejects.toThrow("503");
        await expect(loadUsers()).rejects.toThrow("503");
    });

    test("local drafts are merged with the API data and survive a reload", async () => {
        let courses = await addCourse([], { code: "NEW", name: "Nuevo" });
        courses = await updateCourse(courses, courses[0].id, { name: "Nuevo curso" });
        expect((await loadCourses()).map((c) => c.name)).toEqual(["Bases de datos", "Nuevo curso"]);
        await deleteCourse(courses, courses[0].id);
        expect((await loadCourses()).map((c) => c.code)).toEqual(["BD"]);

        let fichas = await addFicha([], { code: "F-NEW" });
        fichas = await updateFicha(fichas, fichas[0].id, { code: "F-NEW2" });
        expect((await loadFichas()).some((f) => f.code === "F-NEW2")).toBe(true);
        await deleteFicha(fichas, fichas[0].id);

        await addStudentsBulk(await addStudent([], { name: "Local" }), [{ name: "Bulk" }]);
        expect((await loadStudents()).filter((s) => s.id.startsWith("s_")).map((s) => s.name)).toEqual(["Local", "Bulk"]);

        let envs = await addEnvironment([], { number: "L-1", schedules: [] });
        envs = await addScheduleToEnvironment(envs, envs[0].id, { courseCode: "BD" });
        envs = await updateSchedule(envs, envs[0].id, envs[0].schedules[0].id, { courseCode: "RED" });
        expect(envs[0].schedules[0].courseCode).toBe("RED");
        envs = await deleteSchedule(envs, envs[0].id, envs[0].schedules[0].id);
        envs = await updateEnvironment(envs, envs[0].id, { number: "L-2" });
        expect((await loadEnvironments()).map((e) => e.number)).toEqual(["B-101", "L-2"]);
        await deleteEnvironment(envs, envs[0].id);

        let users = await addUser([], { name: "Local" });
        users = await updateUser(users, users[0].id, { name: "Local 2" });
        expect((await loadUsers()).some((u) => u.name === "Local 2")).toBe(true);
        await deleteUser(users, users[0].id);
    });
});
