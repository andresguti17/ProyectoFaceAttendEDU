jest.mock("../authApi", () => ({
    authApi: {
        createPerson: jest.fn(),
        createUser: jest.fn(),
        deletePerson: jest.fn(),
    },
}));
jest.mock("../academicApi", () => ({
    academicApi: {
        createActor: jest.fn(),
        deleteActor: jest.fn(),
        createEnrollment: jest.fn(),
        deleteEnrollment: jest.fn(),
        listSchools: jest.fn(),
    },
}));
jest.mock("../authorizationApi", () => ({
    authorizationApi: {
        listRoles: jest.fn(),
        assignRole: jest.fn(),
    },
}));
jest.mock("../referenceData", () => ({
    listBlocks: jest.fn(),
    listCohorts: jest.fn(),
    listCourses: jest.fn(),
    listPrograms: jest.fn(),
    personMap: jest.fn(),
    resetReferenceData: jest.fn(),
}));

import { authApi } from "../authApi";
import { academicApi } from "../academicApi";
import { authorizationApi } from "../authorizationApi";
import { listBlocks, listCohorts, listCourses, listPrograms, personMap } from "../referenceData";
import { assertPersonUnique, cohortsForCourseCode, findExistingStudents, markExistingStudents, provisionStaff, provisionStudent } from "../staffProvisioning";

const base = {
    name: "Ana García López",
    code: "ADMIN001",
    email: "Ana@universidad.edu",
    documentNumber: "1234567890",
    password: "Secret123",
};

beforeEach(() => {
    jest.clearAllMocks();
    personMap.mockResolvedValue(new Map());
    authApi.createPerson.mockResolvedValue({ personId: "person-1" });
    authApi.createUser.mockResolvedValue({ userId: "user-1" });
    authorizationApi.listRoles.mockResolvedValue([
        { roleId: 1, roleName: "Administrador" },
        { roleId: 2, roleName: "Instructor" },
    ]);
});

test("admin: creates person, user, role and the ADMIN school actor", async () => {
    academicApi.listSchools.mockResolvedValue([{ schoolId: 2, name: "Sede" }]);
    const result = await provisionStaff({ ...base, role: "admin", schoolId: "2" });

    expect(result).toEqual({ personId: "person-1", userId: "user-1", username: "ana" });
    expect(authApi.createPerson).toHaveBeenCalledWith({
        documentNumber: "1234567890",
        name: "Ana",
        lastName: "García López",
        email: "ana@universidad.edu",
        status: true,
    });
    expect(authApi.createUser).toHaveBeenCalledWith({
        personId: "person-1",
        username: "ana",
        password: "Secret123",
        authenticationType: "Local",
    });
    expect(authorizationApi.assignRole).toHaveBeenCalledWith("user-1", 1);
    expect(academicApi.createActor).toHaveBeenCalledWith(
        expect.objectContaining({ personId: "person-1", actorTypeId: 3, schoolId: 2 })
    );
});

test("admin without school falls back to the only school", async () => {
    academicApi.listSchools.mockResolvedValue([{ schoolId: 2, name: "Sede" }]);
    await provisionStaff({ ...base, role: "admin", schoolId: null });

    expect(academicApi.createActor).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: 2 })
    );
});

test("admin without school fails when several schools exist", async () => {
    academicApi.listSchools.mockResolvedValue([{ schoolId: 2 }, { schoolId: 3 }]);

    await expect(provisionStaff({ ...base, role: "admin", schoolId: null })).rejects.toThrow(
        "No school available"
    );
    expect(authApi.deletePerson).toHaveBeenCalledWith("person-1");
});

test("teacher: also creates the instructor actor in the given school", async () => {
    await provisionStaff({ ...base, role: "teacher", schoolId: 5 });

    expect(academicApi.createActor).toHaveBeenCalledWith(
        expect.objectContaining({
            personId: "person-1",
            actorTypeId: 2,
            schoolId: 5,
            actorCode: "ADMIN001",
        })
    );
    expect(authorizationApi.assignRole).toHaveBeenCalledWith("user-1", 2);
});

test("duplicate document reports the field before posting", async () => {
    personMap.mockResolvedValue(
        new Map([["p-9", { personId: "p-9", documentNumber: "1234567890", email: "other@uni.edu" }]])
    );

    await expect(
        provisionStaff({ ...base, role: "admin", schoolId: "2" })
    ).rejects.toThrow("número de documento");
    expect(authApi.createPerson).not.toHaveBeenCalled();
});

test("duplicate email reports the field before posting", async () => {
    personMap.mockResolvedValue(
        new Map([["p-9", { personId: "p-9", documentNumber: "999", email: "ana@universidad.edu" }]])
    );

    await expect(
        provisionStaff({ ...base, role: "admin", schoolId: "2" })
    ).rejects.toThrow("correo electrónico");
    expect(authApi.createPerson).not.toHaveBeenCalled();
});

test("assertPersonUnique passes through when the roster is unavailable", async () => {
    personMap.mockRejectedValueOnce(new Error("offline"));

    await expect(
        assertPersonUnique({ documentNumber: "1234567890", email: "ana@universidad.edu" })
    ).resolves.toBeUndefined();
});

test("compensates actor and person when user creation fails", async () => {
    academicApi.listSchools.mockResolvedValue([{ schoolId: 2, name: "Sede" }]);
    academicApi.createActor.mockResolvedValue({ academicActorId: 77 });
    authApi.createUser.mockRejectedValueOnce(new Error("duplicate"));

    await expect(
        provisionStaff({ ...base, role: "admin", schoolId: "2" })
    ).rejects.toThrow("duplicate");
    expect(academicApi.deleteActor).toHaveBeenCalledWith(77);
    expect(authApi.deletePerson).toHaveBeenCalledWith("person-1");
});

test("student: resolves the single cohort and enrolls", async () => {
    listCourses.mockResolvedValue([{ courseId: 12, programId: 4, code: "MAT" }]);
    listBlocks.mockResolvedValue([{ scheduleBlockId: 501, courseId: 12, cohortId: 50 }]);
    listCohorts.mockResolvedValue([
        { cohortId: 50, programId: 4, code: "F1", status: true },
        { cohortId: 51, programId: 4, code: "F2", status: false },
    ]);
    listPrograms.mockResolvedValue([{ programId: 4, schoolId: 2 }]);
    authorizationApi.listRoles.mockResolvedValue([{ roleId: 5, roleName: "Aprendiz" }]);
    academicApi.createActor.mockResolvedValue({ academicActorId: 601 });
    academicApi.createEnrollment.mockResolvedValue({ enrollmentId: 701 });

    const result = await provisionStudent({
        ...base,
        courseCode: "MAT",
    });

    expect(result).toEqual({
        personId: "person-1",
        userId: "user-1",
        actorId: 601,
        cohortId: 50,
    });
    expect(academicApi.createActor).toHaveBeenCalledWith(
        expect.objectContaining({ actorTypeId: 1, schoolId: 2, actorCode: "ADMIN001" })
    );
    expect(academicApi.createEnrollment).toHaveBeenCalledWith(
        expect.objectContaining({ academicActorId: 601, cohortId: 50, enrollmentStatus: "Active" })
    );
    expect(authorizationApi.assignRole).toHaveBeenCalledWith("user-1", 5);
});

test("student: requires cohort choice when several are active", async () => {
    listCourses.mockResolvedValue([{ courseId: 12, programId: 4, code: "MAT" }]);
    listBlocks.mockResolvedValue([
        { scheduleBlockId: 501, courseId: 12, cohortId: 50 },
        { scheduleBlockId: 502, courseId: 12, cohortId: 52 },
    ]);
    listCohorts.mockResolvedValue([
        { cohortId: 50, programId: 4, code: "F1", status: true },
        { cohortId: 52, programId: 4, code: "F2", status: true },
    ]);
    listPrograms.mockResolvedValue([{ programId: 4, schoolId: 2 }]);

    await expect(provisionStudent({ ...base, courseCode: "MAT" })).rejects.toThrow(
        "Select the student cohort"
    );
    expect(authApi.createPerson).not.toHaveBeenCalled();
});

test("student: compensates enrollment, actor and person on user failure", async () => {
    listCourses.mockResolvedValue([{ courseId: 12, programId: 4, code: "MAT" }]);
    listBlocks.mockResolvedValue([{ scheduleBlockId: 501, courseId: 12, cohortId: 50 }]);
    listCohorts.mockResolvedValue([{ cohortId: 50, programId: 4, code: "F1", status: true }]);
    listPrograms.mockResolvedValue([{ programId: 4, schoolId: 2 }]);
    authorizationApi.listRoles.mockResolvedValue([{ roleId: 5, roleName: "Aprendiz" }]);
    academicApi.createActor.mockResolvedValue({ academicActorId: 601 });
    academicApi.createEnrollment.mockResolvedValue({ enrollmentId: 701 });
    authApi.createUser.mockRejectedValueOnce(new Error("duplicate"));

    await expect(provisionStudent({ ...base, courseCode: "MAT" })).rejects.toThrow("duplicate");
    expect(academicApi.deleteEnrollment).toHaveBeenCalledWith(701);
    expect(academicApi.deleteActor).toHaveBeenCalledWith(601);
    expect(authApi.deletePerson).toHaveBeenCalledWith("person-1");
});

describe("markExistingStudents", () => {
    const roster = new Map([
        ["p-1", { personId: "p-1", documentNumber: "1015407712", email: "justin@ejemplo.com" }],
        ["p-2", { personId: "p-2", documentNumber: "999", email: null }],
    ]);

    test("marca por correo (case-insensitive) y por documento efectivo", () => {
        const rows = [
            { name: "A", code: "C1", email: "JUSTIN@EJEMPLO.COM", documentNumber: "" },
            { name: "B", code: "999", email: "b@nuevo.com" },
            { name: "C", code: "C3", email: "c@nuevo.com", documentNumber: "123" },
        ];
        const out = markExistingStudents(rows, roster.values());
        expect(out[0].existing).toBe(true);  // correo ya registrado
        expect(out[1].existing).toBe(true);  // code como documento efectivo
        expect(out[2].existing).toBeUndefined(); // fila nueva intacta
        expect(out).toHaveLength(3);          // nunca descarta filas
    });

    test("padrón vacío no marca nada", () => {
        const rows = [{ name: "A", code: "1", email: "a@b.com" }];
        expect(markExistingStudents(rows, new Map().values())[0].existing).toBeUndefined();
    });
});

describe("findExistingStudents", () => {
    test("consulta el padrón y marca los duplicados", async () => {
        personMap.mockResolvedValue(
            new Map([["p-1", { personId: "p-1", documentNumber: "1", email: "a@b.com" }]])
        );
        const out = await findExistingStudents([{ name: "A", code: "2", email: "a@b.com" }]);
        expect(out[0].existing).toBe(true);
    });

    test("si el padrón no carga no se marca nada (el backend es la autoridad)", async () => {
        personMap.mockRejectedValueOnce(new Error("offline"));
        const rows = [{ name: "A", code: "2", email: "a@b.com" }];
        await expect(findExistingStudents(rows)).resolves.toEqual(rows);
    });
});
