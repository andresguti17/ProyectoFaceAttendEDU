jest.mock("../authApi", () => ({
    authApi: {
        provisionUser: jest.fn(),
    },
}));
jest.mock("../academicApi", () => ({
    academicApi: {
        listSchools: jest.fn(),
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
import { listBlocks, listCohorts, listCourses, listPrograms, personMap } from "../referenceData";
import { assertPersonUnique, cohortsForCourseCode, credentialsNotice, findExistingStudents, importStudents, markExistingStudents, provisionStaff, provisionStudent } from "../staffProvisioning";

const base = {
    name: "Ana García López",
    code: "ADMIN001",
    email: "Ana@universidad.edu",
    documentNumber: "1234567890",
    password: "Secret123",
    consent: { privacyAccepted: true, biometricAccepted: false },
};

function oneCohortCourse() {
    listCourses.mockResolvedValue([{ courseId: 12, programId: 4, code: "MAT" }]);
    listBlocks.mockResolvedValue([{ scheduleBlockId: 501, courseId: 12, cohortId: 50 }]);
    listCohorts.mockResolvedValue([
        { cohortId: 50, programId: 4, code: "F1", status: true },
        { cohortId: 51, programId: 4, code: "F2", status: false },
    ]);
    listPrograms.mockResolvedValue([{ programId: 4, schoolId: 2 }]);
}

beforeEach(() => {
    jest.clearAllMocks();
    personMap.mockResolvedValue(new Map());
    authApi.provisionUser.mockResolvedValue({ personId: "person-1", userId: "user-1", username: "ana", academicActorId: 601 });
});

test("the real authApi has no person delete: compensation lives on the server", () => {
    const { authApi: real } = jest.requireActual("../authApi");
    expect(real.deletePerson).toBeUndefined();
    expect(typeof real.provisionUser).toBe("function");
});

test("admin: one server call with person, role and the ADMIN school actor", async () => {
    const result = await provisionStaff({ ...base, role: "admin", schoolId: "2" });

    expect(result).toEqual({ personId: "person-1", userId: "user-1", username: "ana", credentialsEmail: null });
    expect(authApi.provisionUser).toHaveBeenCalledTimes(1);
    expect(authApi.provisionUser).toHaveBeenCalledWith({
        person: {
            documentNumber: "1234567890",
            name: "Ana",
            lastName: "García López",
            email: "ana@universidad.edu",
            status: true,
        },
        username: "ana",
        password: "Secret123",
        sendCredentials: false,
        roleName: "Administrador",
        academicActor: { actorTypeId: 3, schoolId: 2, actorCode: "ADMIN001" },
        consent: { policyVersion: "2026-11", biometricAccepted: false },
    });
});

test("admin without school falls back to the only school", async () => {
    academicApi.listSchools.mockResolvedValue([{ schoolId: 2, name: "Sede" }]);
    await provisionStaff({ ...base, role: "admin", schoolId: null });

    expect(authApi.provisionUser).toHaveBeenCalledWith(
        expect.objectContaining({ academicActor: expect.objectContaining({ schoolId: 2 }) })
    );
});

test("admin without school fails before creating anything when several schools exist", async () => {
    academicApi.listSchools.mockResolvedValue([{ schoolId: 2 }, { schoolId: 3 }]);

    await expect(provisionStaff({ ...base, role: "admin", schoolId: null })).rejects.toThrow("No school available");
    expect(authApi.provisionUser).not.toHaveBeenCalled();
});

test("teacher: instructor role and actor in the given school", async () => {
    await provisionStaff({ ...base, role: "teacher", schoolId: 5 });

    expect(authApi.provisionUser).toHaveBeenCalledWith(
        expect.objectContaining({
            roleName: "Instructor",
            academicActor: { actorTypeId: 2, schoolId: 5, actorCode: "ADMIN001" },
        })
    );
});

test("a server failure is reported as is (the server already undid every step)", async () => {
    authApi.provisionUser.mockRejectedValueOnce(Object.assign(new Error("Could not assign the role"), { status: 503 }));

    await expect(provisionStaff({ ...base, role: "teacher", schoolId: 5 })).rejects.toThrow("Could not assign the role");
});

test("duplicate document reports the field before posting", async () => {
    personMap.mockResolvedValue(
        new Map([["p-9", { personId: "p-9", documentNumber: "1234567890", email: "other@uni.edu" }]])
    );

    await expect(provisionStaff({ ...base, role: "admin", schoolId: "2" })).rejects.toThrow("número de documento");
    expect(authApi.provisionUser).not.toHaveBeenCalled();
});

test("duplicate email reports the field before posting", async () => {
    personMap.mockResolvedValue(
        new Map([["p-9", { personId: "p-9", documentNumber: "999", email: "ana@universidad.edu" }]])
    );

    await expect(provisionStaff({ ...base, role: "admin", schoolId: "2" })).rejects.toThrow("correo electrónico");
    expect(authApi.provisionUser).not.toHaveBeenCalled();
});

test("assertPersonUnique passes through when the roster is unavailable", async () => {
    personMap.mockRejectedValueOnce(new Error("offline"));

    await expect(
        assertPersonUnique({ documentNumber: "1234567890", email: "ana@universidad.edu" })
    ).resolves.toBeUndefined();
});

test("student: resolves the single cohort and asks the server to enroll", async () => {
    oneCohortCourse();
    authApi.provisionUser.mockResolvedValue({ personId: "person-1", userId: "user-1", academicActorId: 601, enrollmentId: 701 });

    const result = await provisionStudent({ ...base, courseCode: "MAT" });

    expect(result).toEqual({ personId: "person-1", userId: "user-1", actorId: 601, cohortId: 50, credentialsEmail: null });
    expect(authApi.provisionUser).toHaveBeenCalledWith(
        expect.objectContaining({
            roleName: "Aprendiz",
            academicActor: { actorTypeId: 1, schoolId: 2, actorCode: "ADMIN001", cohortId: 50 },
        })
    );
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

    await expect(provisionStudent({ ...base, courseCode: "MAT" })).rejects.toThrow("Select the student cohort");
    expect(authApi.provisionUser).not.toHaveBeenCalled();
});

test("no account is created without the privacy notice (Ley 1581)", async () => {
    await expect(provisionStaff({ ...base, consent: null, role: "teacher", schoolId: 5 })).rejects.toThrow("aviso de privacidad");
    await expect(importStudents([{ name: "A", code: "1", email: "a@b.c", course: "MAT" }])).rejects.toThrow("aviso de privacidad");
    expect(authApi.provisionUser).not.toHaveBeenCalled();
});

test("cohortsForCourseCode returns nothing for an unknown course", async () => {
    listCourses.mockResolvedValue([]);
    await expect(cohortsForCourseCode("XYZ")).resolves.toEqual([]);
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
        expect(out[0].existing).toBe(true);
        expect(out[1].existing).toBe(true);
        expect(out[2].existing).toBeUndefined();
        expect(out).toHaveLength(3);
    });

    test("padrón vacío no marca nada", () => {
        const rows = [{ name: "A", code: "1", email: "a@b.com" }];
        expect(markExistingStudents(rows, new Map().values())[0].existing).toBeUndefined();
    });
});

describe("findExistingStudents", () => {
    test("consulta el padrón y marca los duplicados", async () => {
        personMap.mockResolvedValue(new Map([["p-1", { personId: "p-1", documentNumber: "1", email: "a@b.com" }]]));
        const out = await findExistingStudents([{ name: "A", code: "2", email: "a@b.com" }]);
        expect(out[0].existing).toBe(true);
    });

    test("si el padrón no carga no se marca nada (el backend es la autoridad)", async () => {
        personMap.mockRejectedValueOnce(new Error("offline"));
        const rows = [{ name: "A", code: "2", email: "a@b.com" }];
        await expect(findExistingStudents(rows)).resolves.toEqual(rows);
    });
});

describe("credentials email", () => {
    test("staff: forwards sendCredentials and returns the email status", async () => {
        authApi.provisionUser.mockResolvedValue({ userId: "user-1", username: "ana", credentialsEmail: "SENT" });

        const result = await provisionStaff({ ...base, role: "admin", schoolId: "2", sendCredentials: true });

        expect(authApi.provisionUser).toHaveBeenCalledWith(expect.objectContaining({ sendCredentials: true }));
        expect(result.credentialsEmail).toBe("SENT");
    });

    describe("credentialsNotice", () => {
        test("is null when the email was not requested", () => {
            expect(credentialsNotice({ sendCredentials: false }, { credentialsEmail: "SENT" })).toBeNull();
        });

        test("reports the backend status, or FAILED when the backend sent none", () => {
            expect(credentialsNotice({ sendCredentials: true }, { credentialsEmail: "SKIPPED" })).toEqual({ credentialsEmail: "SKIPPED" });
            expect(credentialsNotice({}, {})).toEqual({ credentialsEmail: "FAILED" });
        });
    });

    describe("importStudents", () => {
        const rows = [
            { name: "Ana Uno", code: "A1", email: "a1@u.edu", course: "MAT" },
            { name: "Beto Dos", code: "B2", email: "b2@u.edu", course: "MAT" },
        ];

        beforeEach(() => {
            oneCohortCourse();
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        async function run(options) {
            const promise = importStudents(rows, { privacyAccepted: true, ...options });
            await jest.runAllTimersAsync();
            return promise;
        }

        test("sends a different random password per student and tallies who got the email", async () => {
            authApi.provisionUser
                .mockResolvedValueOnce({ userId: "u1", credentialsEmail: "SENT" })
                .mockResolvedValueOnce({ userId: "u2", credentialsEmail: "FAILED" });

            const result = await run();

            const passwords = authApi.provisionUser.mock.calls.map(([body]) => body.password);
            expect(passwords[0]).not.toBe(passwords[1]);
            expect(passwords.every((p) => p !== "Estudiante123!" && p.length >= 8)).toBe(true);
            expect(result.success).toBe(2);
            expect(result.credentials).toEqual({ sent: 1, notSent: ["Beto Dos"] });
        });

        test("without sendCredentials uses a random per-student password (never a shared one) and no email", async () => {
            authApi.provisionUser.mockResolvedValue({ userId: "u1" });

            const result = await run({ sendCredentials: false });

            const passwords = authApi.provisionUser.mock.calls.map(([body]) => body.password);
            expect(authApi.provisionUser).toHaveBeenCalledWith(expect.objectContaining({ sendCredentials: false }));
            expect(new Set(passwords).size).toBe(passwords.length);
            expect(passwords.every((p) => p !== "Estudiante123!" && p.length >= 8)).toBe(true);
            expect(result.credentials).toEqual({ sent: 0, notSent: [] });
        });

        test("a failed row is reported and the import continues", async () => {
            authApi.provisionUser
                .mockRejectedValueOnce(new Error("Could not enroll the apprentice"))
                .mockResolvedValueOnce({ userId: "u2", credentialsEmail: "SENT" });

            const result = await run();

            expect(result.success).toBe(1);
            expect(result.errors).toEqual([{ student: "Ana Uno", reason: "Could not enroll the apprentice" }]);
        });
    });
});
