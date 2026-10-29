// Ambientes y horarios (HU-ACAD-001): validación del formulario, choques de horario y el camino a
// ms-scheduling para ambientes y bloques reales.
jest.mock("../../context/AppDataContext", () => ({ useAppData: jest.fn() }));
jest.mock("../../services/api/environmentManagement", () => ({
    backendEnvId: (id) => (/^\d+$/.test(String(id)) ? Number(id) : null),
    createEnvironment: jest.fn(),
    updateEnvironment: jest.fn(),
    deleteEnvironment: jest.fn(),
}));
jest.mock("../../services/api/scheduleBlockManagement", () => ({
    backendScheduleId: (id) => (/^\d+$/.test(String(id)) ? Number(id) : null),
    cohortsForCourse: jest.fn(),
    createBlocks: jest.fn(),
    createdBlockId: (b) => String(b.scheduleBlockId),
    dayLabelToIso: (d) => ({ Lun: 1, Mar: 2, Mié: 3, Jue: 4, Vie: 5 }[d] ?? null),
    isoToDayLabel: (n) => ["Lun", "Mar", "Mié", "Jue", "Vie"][n - 1] ?? null,
    deleteBlock: jest.fn(),
    instructorActorForUser: jest.fn(),
    replaceBlock: jest.fn(),
}));

import { useAppData } from "../../context/AppDataContext";
import { createEnvironment, updateEnvironment, deleteEnvironment } from "../../services/api/environmentManagement";
import { cohortsForCourse, createBlocks, deleteBlock, instructorActorForUser, replaceBlock } from "../../services/api/scheduleBlockManagement";
import { saveInstitutionConfig, getDefaultInstitutionConfig } from "../../core/config/institutionConfig";
import { useEnvironmentsViewModel, validateEnvironmentForm, validateScheduleForm, getTimePlaceholders, EMPTY_SCHEDULE_FORM } from "../useEnvironmentsViewModel";
import { renderHook, act } from "./support/renderHook";

const SCHEDULE = { id: "7", courseCode: "BD", courseName: "Bases de datos", instructorName: "Iván", startTime: "07:00", endTime: "09:00", days: ["Lun", "Mié"] };
const form = (over = {}) => ({ ...EMPTY_SCHEDULE_FORM, courseCode: "RED", courseName: "Redes", instructorId: "u-5", instructorName: "Sara", startTime: "10:00", endTime: "12:00", days: ["Lun"], ...over });

describe("validation", () => {
    test("an environment needs its number", () => {
        expect(validateEnvironmentForm({ number: "  " })).toBe("El número del ambiente es requerido");
        expect(validateEnvironmentForm({ number: "B-101" })).toBeNull();
    });

    test("a schedule needs course, instructor, days and a valid time range", () => {
        expect(validateScheduleForm(form({ courseCode: "" }))).toBe("Completa todos los campos");
        expect(validateScheduleForm(form({ instructorId: "" }))).toBe("Selecciona un instructor");
        expect(validateScheduleForm(form({ days: [] }))).toBe("Selecciona al menos un día");
        expect(validateScheduleForm(form({ endTime: "" }))).toBe("Completa el horario");
        expect(validateScheduleForm(form({ endTime: "10:00" }))).toBe("La hora de fin debe ser mayor a la hora de inicio");
        saveInstitutionConfig({ ...getDefaultInstitutionConfig(), timeFormat24h: true });
        expect(validateScheduleForm(form({ startTime: "25:00" }))).toMatch(/Ejemplo: 14:30/);
        expect(validateScheduleForm(form())).toBeNull();
    });

    test("12-hour times are understood, including noon and midnight", () => {
        expect(validateScheduleForm(form({ startTime: "11:00 AM", endTime: "12:30 PM" }))).toBeNull();
        expect(validateScheduleForm(form({ startTime: "12:00 PM", endTime: "12:00 AM" }))).toBe("La hora de fin debe ser mayor a la hora de inicio");
    });

    test("a course larger than the room is refused", () => {
        expect(validateScheduleForm(form(), [], 20, { students: 25 })).toMatch(/capacidad maxima del ambiente de 20/);
        expect(validateScheduleForm(form(), [], 30, { students: 25 })).toBeNull();
    });

    test("overlapping a block on a shared day is a conflict; the block being edited is ignored", () => {
        expect(validateScheduleForm(form({ startTime: "08:00", endTime: "10:00" }), [SCHEDULE])).toMatch(/Conflicto de horarios.*Lun/);
        expect(validateScheduleForm(form({ startTime: "06:00", endTime: "10:00" }), [SCHEDULE])).toMatch(/Conflicto/);
        expect(validateScheduleForm(form({ startTime: "09:00", endTime: "10:00" }), [SCHEDULE])).toBeNull(); // contiguo
        expect(validateScheduleForm(form({ startTime: "08:00", endTime: "10:00", days: ["Mar"] }), [SCHEDULE])).toBeNull();
        expect(validateScheduleForm(form({ startTime: "08:00", endTime: "10:00" }), [SCHEDULE], 0, null, "7")).toBeNull();
    });

    test("time suggestions look for the first free two-hour slot", () => {
        expect(getTimePlaceholders("tarde", [], [], true)).toMatchObject({ suggestedStart: "12:00", suggestedEnd: "18:00" });
        expect(getTimePlaceholders("mañana", [SCHEDULE], ["Mar"], true).suggestedStart).toBe("06:00");
        expect(getTimePlaceholders("mañana", [{ ...SCHEDULE, startTime: "06:00", endTime: "09:00" }], ["Lun"], true))
            .toMatchObject({ suggestedStart: "09:00", suggestedEnd: "11:00" });
        expect(getTimePlaceholders("mañana", [{ ...SCHEDULE, startTime: "06:00", endTime: "09:00" }], ["Lun"], false).suggestedStart).toBe("9:00 AM");
        expect(getTimePlaceholders("noche", [{ ...SCHEDULE, startTime: "06:00", endTime: "23:00" }], ["Lun"], true))
            .toMatchObject({ suggestedStart: "18:00", suggestedEnd: "22:00" });
    });
});

describe("viewmodel", () => {
    let appData;
    beforeEach(() => {
        jest.clearAllMocks();
        appData = {
            environments: [
                { id: "4", number: "B-101", description: "Sala 1", capacity: 30, schedules: [SCHEDULE] },
                { id: "env_local", number: "L-1", description: "Local", capacity: 10, schedules: [] },
            ],
            users: [{ id: "u-5", name: "Sara", role: "teacher", status: "active", code: "sara" }, { id: "u-9", name: "Admin", role: "admin", status: "active" }],
            courses: [{ id: "11", code: "RED", students: 20 }, { id: "course_x", code: "LOC", students: 1 }],
            isLoading: false,
            addEnvironment: jest.fn(), updateEnvironment: jest.fn(), removeEnvironment: jest.fn(),
            addSchedule: jest.fn(), updateSchedule: jest.fn(), removeSchedule: jest.fn(),
        };
        useAppData.mockReturnValue(appData);
    });

    async function vm() {
        return (await renderHook(useEnvironmentsViewModel)).result;
    }

    test("search covers number, description and the courses and instructors of its blocks", async () => {
        const v = await vm();
        act(() => v().setSearch("iván"));
        expect(v().filtered.map((e) => e.id)).toEqual(["4"]);
        act(() => v().setSearch("local"));
        expect(v().filtered.map((e) => e.id)).toEqual(["env_local"]);
        expect(v().instructors.map((u) => u.id)).toEqual(["u-5"]);
        expect(v().searchInstructors("SAR").map((u) => u.id)).toEqual(["u-5"]);
        expect(v().searchInstructors(" ")).toHaveLength(1);
    });

    test("registering requires the school and goes to the backend first", async () => {
        createEnvironment.mockResolvedValue({ id: "12", number: "B-102" });
        const v = await vm();

        expect(await v().registerEnvironment({ number: "B-102", description: "", capacity: "", schoolId: "" })).toBe("Selecciona la sede");
        expect(await v().registerEnvironment({ number: "B-102", description: "", capacity: "", schoolId: "2" })).toBeNull();
        expect(createEnvironment).toHaveBeenCalledWith({ schoolId: "2", code: "B-102", name: "Sin descripción", capacity: 30 });
        expect(appData.addEnvironment).toHaveBeenCalledWith({ id: "12", number: "B-102" });

        createEnvironment.mockRejectedValue(new Error("Código repetido"));
        expect(await v().registerEnvironment({ number: "B-102", description: "x", capacity: "5", schoolId: "2" })).toBe("Código repetido");
    });

    test("editing and deleting call the backend only for backend rows", async () => {
        const v = await vm();

        await act(async () => {
            expect(await v().editEnvironment("4", { number: " B-101 ", description: "Sala grande", capacity: "40" })).toBeNull();
        });
        expect(updateEnvironment).toHaveBeenCalledWith("4", { code: "B-101", name: "Sala grande", capacity: 40 });
        expect(v().selected).toMatchObject({ id: "4", description: "Sala grande" });

        await act(async () => v().editEnvironment("env_local", { number: "L-2", description: "", capacity: "" }));
        expect(updateEnvironment).toHaveBeenCalledTimes(1);

        deleteEnvironment.mockRejectedValueOnce(new Error("Tiene bloques"));
        expect(await v().removeEnvironment("4")).toBe("Tiene bloques");
        expect(appData.removeEnvironment).not.toHaveBeenCalled();
        await act(async () => v().removeEnvironment("env_local"));
        expect(deleteEnvironment).toHaveBeenCalledTimes(1);
        expect(appData.removeEnvironment).toHaveBeenCalledWith("env_local");
    });

    test("a schedule on a backend room creates one block per day for the course cohort", async () => {
        cohortsForCourse.mockResolvedValue([{ cohortId: 5 }]);
        instructorActorForUser.mockResolvedValue(50);
        createBlocks.mockResolvedValue([{ scheduleBlockId: 20, dayOfWeek: 2 }, { scheduleBlockId: 21, dayOfWeek: 4 }]);
        const v = await vm();
        act(() => v().openAddSchedule("4"));

        let result;
        await act(async () => {
            result = await v().saveSchedule(form({ days: ["Mar", "Jue"], startTime: "02:00 PM", endTime: "04:00 PM" }));
        });

        expect(result).toBeNull();
        expect(createBlocks).toHaveBeenCalledWith({ environmentId: 4, courseId: 11, cohortId: 5, instructorActorId: 50, daysOfWeek: [2, 4], startsAt: "14:00", endsAt: "16:00" });
        expect(appData.addSchedule.mock.calls.map(([, s]) => [s.id, s.days])).toEqual([["20", ["Mar"]], ["21", ["Jue"]]]);
    });

    test("backend schedule errors are explained", async () => {
        const v = await vm();
        act(() => v().openAddSchedule("4"));

        cohortsForCourse.mockResolvedValue([]);
        expect(await v().saveSchedule(form())).toBe("El curso no tiene fichas activas en el backend");
        cohortsForCourse.mockResolvedValue([{ cohortId: 5 }, { cohortId: 6 }]);
        expect(await v().saveSchedule(form())).toBe("Selecciona la ficha del horario");
        instructorActorForUser.mockResolvedValue(null);
        expect(await v().saveSchedule(form({ cohortId: "5" }))).toBe("El instructor no tiene actor docente en la sede");
        instructorActorForUser.mockResolvedValue(50);
        createBlocks.mockRejectedValue(new Error("Choque con otro bloque del instructor"));
        expect(await v().saveSchedule(form({ cohortId: "5" }))).toBe("Choque con otro bloque del instructor");
        expect(await v().saveSchedule(form({ cohortId: "5", startTime: "08:00", endTime: "10:00" }))).toMatch(/Conflicto/);
    });

    test("editing a backend block replaces it; local rows stay local", async () => {
        cohortsForCourse.mockResolvedValue([{ cohortId: 5 }]);
        instructorActorForUser.mockResolvedValue(50);
        replaceBlock.mockResolvedValue([{ scheduleBlockId: 30, dayOfWeek: 1 }]);
        const v = await vm();
        act(() => v().openEditSchedule("4", SCHEDULE));

        await act(async () => v().saveSchedule(form({ courseCode: "RED", startTime: "07:00", endTime: "09:00", days: ["Lun"] })));
        expect(replaceBlock).toHaveBeenCalledWith("7", expect.objectContaining({ daysOfWeek: [1] }));
        expect(appData.removeSchedule).toHaveBeenCalledWith("4", "7");
        expect(appData.addSchedule).toHaveBeenCalledWith("4", expect.objectContaining({ id: "30" }));

        act(() => v().openAddSchedule("env_local"));
        await act(async () => v().saveSchedule(form({ courseCode: "LOC" })));
        expect(appData.addSchedule).toHaveBeenLastCalledWith("env_local", expect.objectContaining({ courseCode: "LOC" }));
        expect(createBlocks).not.toHaveBeenCalled();
    });

    test("removing a backend block deletes it in scheduling first", async () => {
        const v = await vm();
        deleteBlock.mockRejectedValueOnce(new Error("404"));

        expect(await v().removeSchedule("4", "7")).toBe("404");
        expect(appData.removeSchedule).not.toHaveBeenCalled();
        await act(async () => v().removeSchedule("4", "7"));
        expect(appData.removeSchedule).toHaveBeenCalledWith("4", "7");
    });

    test("modal state helpers", async () => {
        const v = await vm();
        act(() => v().openRegisterModal());
        expect(v().envModalMode).toBe("register");
        act(() => v().openEditModal(appData.environments[0]));
        expect(v()).toMatchObject({ envModalMode: "edit", selected: { id: "4" } });
        act(() => v().selectEnvironment(appData.environments[1]));
        expect(v().envModalMode).toBe("detail");
        act(() => v().clearSelection());
        expect(v().selected).toBeNull();
        act(() => v().openAddSchedule("4"));
        expect(v().getCurrentEnvironment().id).toBe("4");
        expect(v().getCourseByCode("RED").id).toBe("11");
        act(() => v().closeScheduleModal());
        expect(v().scheduleModalMode).toBe("none");
        expect(await v().saveSchedule(form())).toBe("Error interno");
        act(() => window.dispatchEvent(new Event("periodAdvanced")));
    });
});
