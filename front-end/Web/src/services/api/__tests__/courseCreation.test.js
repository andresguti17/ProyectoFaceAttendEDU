jest.mock("../academicApi", () => ({
    academicApi: {
        listPrograms: jest.fn(),
        listSchoolPrograms: jest.fn(),
        createCourse: jest.fn(),
    },
}));

import { academicApi } from "../academicApi";
import { createCourse, importCourses, listSchoolPrograms } from "../courseCreation";

beforeEach(() => {
    jest.clearAllMocks();
});

test("lists school programs with canonical ids", async () => {
    academicApi.listSchoolPrograms.mockResolvedValue([
        { programId: 4, code: "ADSI", name: "Análisis y Desarrollo" },
        { program_id: 5, code: "MULT", name: "Multimedia" },
        { code: "VOID" },
    ]);

    const programs = await listSchoolPrograms(2);

    expect(academicApi.listSchoolPrograms).toHaveBeenCalledWith(2);
    expect(programs).toEqual([
        { programId: 4, schoolId: 2, code: "ADSI", name: "Análisis y Desarrollo" },
        { programId: 5, schoolId: 2, code: "MULT", name: "Multimedia" },
    ]);
});

test("falls back to all programs without a school context", async () => {
    academicApi.listPrograms.mockResolvedValue([
        { programId: 4, schoolId: 2, code: "ADSI", name: "Análisis y Desarrollo" },
    ]);

    const programs = await listSchoolPrograms(null);

    expect(academicApi.listSchoolPrograms).not.toHaveBeenCalled();
    expect(programs).toEqual([
        { programId: 4, schoolId: 2, code: "ADSI", name: "Análisis y Desarrollo" },
    ]);
});

test("creates the course inside the chosen program", async () => {
    academicApi.createCourse.mockResolvedValue({ courseId: 9 });

    await createCourse({ programId: "4", code: " 2240083 ", name: " ADSI " });

    expect(academicApi.createCourse).toHaveBeenCalledWith({
        programId: 4,
        code: "2240083",
        name: "ADSI",
        status: true,
    });
});

test("requires a program", async () => {
    await expect(createCourse({ programId: "", code: "X", name: "Y" })).rejects.toThrow(
        "A program is required"
    );
    expect(academicApi.createCourse).not.toHaveBeenCalled();
});

test("bulk import resolves programs once and collects per-row errors", async () => {
    academicApi.listSchoolPrograms.mockResolvedValue([
        { programId: 4, code: "ADSI", name: "Análisis y Desarrollo" },
    ]);
    academicApi.createCourse.mockResolvedValueOnce({ courseId: 1 });
    academicApi.createCourse.mockRejectedValueOnce(new Error("duplicate"));

    const result = await importCourses(2, [
        { code: "2240083", name: "Bases de Datos", program: "adsi" },
        { code: "2240084", name: "Redes", program: "ADSI" },
        { code: "2240085", name: "Sin programa", program: "OTRO" },
        { code: "", name: "Sin código", program: "ADSI" },
    ]);

    expect(result.success).toBe(1);
    expect(result.errors).toEqual([
        { course: "2240084", reason: "duplicate" },
        { course: "2240085", reason: "Programa no encontrado en la sede" },
        { course: "Sin código", reason: "Código y nombre son requeridos" },
    ]);
    expect(academicApi.listSchoolPrograms).toHaveBeenCalledTimes(1);
});
