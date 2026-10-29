// Cada cliente HTTP llama a la ruta del catálogo con el método y el cuerpo que espera su servicio.
// endpointsContract.test.js verifica que esas rutas existan en los contratos OpenAPI.
jest.mock("../../../api/apiClient", () => ({ request: jest.fn(async () => ({})) }));
jest.mock("../referenceData", () => ({ resetReferenceData: jest.fn() }));
jest.mock("../settingsPersistence", () => ({ pushInstitutionConfig: jest.fn() }));

import { request } from "../../../api/apiClient";
import { resetReferenceData } from "../referenceData";
import { pushInstitutionConfig } from "../settingsPersistence";
import { authApi } from "../authApi";
import { academicApi } from "../academicApi";
import { attendanceApi } from "../attendanceApi";
import { schedulingApi } from "../schedulingApi";
import { authorizationApi } from "../authorizationApi";
import { configurationApi } from "../configurationApi";
import { biometricCaptureApi } from "../biometricCaptureApi";
import { listSchoolPeriods, createPeriod, createCohort } from "../fichaCreation";
import { todayLocalIso, periodNameFor, currentPeriodOf, isConfiguredPeriod, syncAcademicPeriodFromSettings, alignSettingsWithPeriods } from "../periodSync";
import { saveInstitutionConfig, getDefaultInstitutionConfig, getInstitutionConfig } from "../../../core/config/institutionConfig";

beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({});
});

const call = (i = 0) => {
    const [url, opts = {}] = request.mock.calls[i];
    return { url, method: opts.method, body: opts.body, query: opts.query, headers: opts.headers };
};

describe("authApi", () => {
    test.each([
        ["login by e-mail", () => authApi.login({ email: "a@x.co", password: "p" }), "POST", "/api/v1/auth/login", { email: "a@x.co", password: "p" }],
        ["login by username", () => authApi.login({ username: "ana", password: "p" }), "POST", "/api/v1/auth/login", { email: "ana", password: "p" }],
        ["second factor", () => authApi.verifyLogin({ username: "ana", code: "123456" }), "POST", "/api/v1/auth/login/verify", { identifier: "ana", code: "123456" }],
        ["change password", () => authApi.changePassword("old", "new"), "POST", "/api/v1/auth/change-password", { currentPassword: "old", newPassword: "new" }],
        ["forgot password", () => authApi.forgotPassword(" Ana@X.co "), "POST", "/api/v1/auth/forgot-password", { email: "ana@x.co" }],
        ["verify code", () => authApi.verifyCode("ANA@x.co", "1"), "POST", "/api/v1/auth/verify-code", { email: "ana@x.co", code: "1" }],
        ["reset password", () => authApi.resetPassword("ana@x.co", "N3w#pass"), "POST", "/api/v1/auth/reset-password", { email: "ana@x.co", password: "N3w#pass" }],
        ["enable 2FA", () => authApi.enableTwoFactor("p"), "POST", "/api/v1/auth/two-factor/enable", { password: "p" }],
        ["confirm 2FA", () => authApi.confirmTwoFactor("1"), "POST", "/api/v1/auth/two-factor/confirm", { code: "1" }],
        ["disable 2FA", () => authApi.disableTwoFactor("p"), "POST", "/api/v1/auth/two-factor/disable", { password: "p" }],
        ["update profile", () => authApi.updateMyProfile({ phone: "1" }), "PUT", "/api/v1/auth/me/profile", { phone: "1" }],
        ["onboard school", () => authApi.onboardSchool({ school: {} }), "POST", "/api/v1/onboarding/schools", { school: {} }],
        ["create person", () => authApi.createPerson({ name: "A" }), "POST", "/api/v1/persons", { name: "A" }],
        ["update person", () => authApi.updatePerson("p1", { name: "A" }), "PUT", "/api/v1/persons/p1", { name: "A" }],
        ["provision user", () => authApi.provisionUser({ username: "a" }), "POST", "/api/v1/users/provision", { username: "a" }],
        ["update user", () => authApi.updateUser("u1", { status: false }), "PUT", "/api/v1/users/u1", { status: false }],
        ["create user", () => authApi.createUser({ username: "a" }), "POST", "/api/v1/users", { username: "a" }],
    ])("%s", async (_n, fn, method, url, body) => {
        await fn();
        expect(call()).toMatchObject({ method, url, body });
    });

    test.each([
        ["me by e-mail", () => authApi.me("a@x.co"), "/api/v1/auth/me", { email: "a@x.co" }],
        ["me by username", () => authApi.me("ana"), "/api/v1/auth/me", { username: "ana" }],
        ["person status", () => authApi.setPersonStatus("p1", false), "/api/v1/persons/p1/status", { status: false }],
        ["user status", () => authApi.setUserStatus("u1", true), "/api/v1/users/u1/status", { status: true }],
        ["user by username", () => authApi.getUserByUsername("ana"), "/api/v1/users", { username: "ana" }],
        ["evaluate", () => authApi.evaluate("u1", "x:read"), "/api/v1/auth/evaluate", { userId: "u1", permission: "x:read" }],
        ["persons", () => authApi.listPersons({ page: 1 }), "/api/v1/persons", { page: 1 }],
        ["users", () => authApi.listUsers({ page: 2 }), "/api/v1/users", { page: 2 }],
        ["sessions", () => authApi.listSessions({ limit: 5 }), "/api/v1/sessions", { limit: 5 }],
    ])("%s sends its filters as query", async (_n, fn, url, query) => {
        await fn();
        expect(call()).toMatchObject({ url, query });
    });

    test.each([
        ["person", () => authApi.getPerson("p1"), "GET", "/api/v1/persons/p1"],
        ["user", () => authApi.getUser("u1"), "GET", "/api/v1/users/u1"],
        ["delete user", () => authApi.deleteUser("u1"), "DELETE", "/api/v1/users/u1"],
        ["session", () => authApi.getSession("s1"), "GET", "/api/v1/sessions/s1"],
        ["sessions of user", () => authApi.listSessionsByUser("u1"), "GET", "/api/v1/sessions/user/u1"],
        ["password policies", () => authApi.getPasswordPolicies(), "GET", "/api/v1/password-policies"],
        ["user roles", () => authApi.userRoles("u1"), "GET", "/api/v1/users/u1/roles"],
    ])("%s", async (_n, fn, method, url) => {
        await fn();
        expect(call()).toMatchObject({ method, url });
    });

    test("logout sends the session as bearer, never in the URL", async () => {
        await authApi.logout("s-1");
        expect(call()).toEqual({ url: "/api/v1/auth/logout", method: "POST", body: undefined, query: undefined, headers: { Authorization: "Bearer s-1" } });
    });

    test("schoolOf takes the active actor and tolerates failures", async () => {
        request.mockResolvedValueOnce([{ status: false, schoolId: 1, academicActorId: 5 }, { schoolId: 2, academicActorId: 6 }]);
        await expect(authApi.schoolOf("p1")).resolves.toEqual({ schoolId: 2, academicActorId: 6 });
        expect(call().url).toBe("/api/v1/academic-actors?personId=p1");

        request.mockResolvedValueOnce([]);
        await expect(authApi.schoolOf("p1")).resolves.toBeNull();
        request.mockRejectedValueOnce(new Error("503"));
        await expect(authApi.schoolOf("p1")).resolves.toBeNull();
    });
});

describe("academic, attendance, scheduling, authorization, configuration", () => {
    test.each([
        [() => academicApi.updateSchoolStatus(2, false), "PATCH", "/api/v1/schools/2/status", { status: false }],
        [() => academicApi.createSchool({ name: "S" }), "POST", "/api/v1/schools", { name: "S" }],
        [() => academicApi.updateSchool(2, { name: "S" }), "PUT", "/api/v1/schools/2", { name: "S" }],
        [() => academicApi.createProgram({ name: "P" }), "POST", "/api/v1/programs", { name: "P" }],
        [() => academicApi.updateProgram(3, { name: "P" }), "PUT", "/api/v1/programs/3", { name: "P" }],
        [() => academicApi.createPeriod({ name: "1" }), "POST", "/api/v1/academic-periods", { name: "1" }],
        [() => academicApi.updatePeriod(4, { isActive: false }), "PUT", "/api/v1/academic-periods/4", { isActive: false }],
        [() => academicApi.createCohort({ code: "F" }), "POST", "/api/v1/cohorts", { code: "F" }],
        [() => academicApi.updateCohort(5, { code: "F" }), "PUT", "/api/v1/cohorts/5", { code: "F" }],
        [() => academicApi.createCourse({ code: "C" }), "POST", "/api/v1/courses", { code: "C" }],
        [() => academicApi.updateCourse(6, { code: "C" }), "PUT", "/api/v1/courses/6", { code: "C" }],
        [() => academicApi.createActor({ personId: "p" }), "POST", "/api/v1/academic-actors", { personId: "p" }],
        [() => academicApi.createEnrollment({ cohortId: 5 }), "POST", "/api/v1/enrollments", { cohortId: 5 }],
        [() => academicApi.updateEnrollmentStatus(7, "Withdrawn"), "PATCH", "/api/v1/enrollments/7/status", { enrollmentStatus: "Withdrawn" }],
        [() => attendanceApi.createRecord({ classSessionId: 1 }), "POST", "/api/v1/attendance-records", { classSessionId: 1 }],
        [() => attendanceApi.updateRecord(8, { attendanceStatus: "Late" }), "PUT", "/api/v1/attendance-records/8", { attendanceStatus: "Late" }],
        [() => attendanceApi.createJustification({ reason: "r" }), "POST", "/api/v1/justifications", { reason: "r" }],
        [() => attendanceApi.updateJustification(9, { reason: "r" }), "PUT", "/api/v1/justifications/9", { reason: "r" }],
        [() => attendanceApi.reviewJustification(9, { reviewStatus: "Approved" }), "PATCH", "/api/v1/justifications/9/review", { reviewStatus: "Approved" }],
        [() => attendanceApi.createJustificationType({ name: "T" }), "POST", "/api/v1/justification-types", { name: "T" }],
        [() => attendanceApi.updateJustificationType(1, { name: "T" }), "PUT", "/api/v1/justification-types/1", { name: "T" }],
        [() => schedulingApi.createEnvironment({ name: "E" }), "POST", "/api/v1/environments", { name: "E" }],
        [() => schedulingApi.updateEnvironment(3, { name: "E" }), "PUT", "/api/v1/environments/3", { name: "E" }],
        [() => schedulingApi.createBlock({ dayOfWeek: 1 }), "POST", "/api/v1/schedule-blocks", { dayOfWeek: 1 }],
        [() => schedulingApi.updateBlock(4, { dayOfWeek: 2 }), "PUT", "/api/v1/schedule-blocks/4", { dayOfWeek: 2 }],
        [() => schedulingApi.createSession({ scheduleBlockId: 4 }), "POST", "/api/v1/class-sessions", { scheduleBlockId: 4 }],
        [() => schedulingApi.openSession(5, 50), "POST", "/api/v1/class-sessions/5/open", { openedBy: 50 }],
        [() => schedulingApi.openSession(5), "POST", "/api/v1/class-sessions/5/open", undefined],
        [() => schedulingApi.closeSession(5, 50), "POST", "/api/v1/class-sessions/5/close", { closedBy: 50 }],
        [() => schedulingApi.closeSession(5), "POST", "/api/v1/class-sessions/5/close", undefined],
        [() => authorizationApi.createRole({ roleName: "R" }), "POST", "/api/v1/roles", { roleName: "R" }],
        [() => authorizationApi.updateRole(1, { roleName: "R" }), "PUT", "/api/v1/roles/1", { roleName: "R" }],
        [() => authorizationApi.createPermission({ code: "x" }), "POST", "/api/v1/permissions", { code: "x" }],
        [() => authorizationApi.assignPermission(1, 2), "POST", "/api/v1/roles/1/permissions", { permissionId: 2 }],
        [() => authorizationApi.assignRole("u1", 3), "POST", "/api/v1/users/u1/roles", { roleId: 3 }],
        [() => configurationApi.createAcademic({ schoolId: 2 }), "POST", "/api/v1/configurations/academic", { schoolId: 2 }],
        [() => configurationApi.updateAcademic(1, { configurationValue: "1" }), "PUT", "/api/v1/configurations/academic/1", { configurationValue: "1" }],
        [() => configurationApi.createSecurity({ configurationName: "x" }), "POST", "/api/v1/configurations/security", { configurationName: "x" }],
        [() => configurationApi.updateSecurity(1, { configurationValue: "1" }), "PUT", "/api/v1/configurations/security/1", { configurationValue: "1" }],
        [() => configurationApi.createBiometricCase({ personId: "p" }), "POST", "/api/v1/biometric-update-cases", { personId: "p" }],
        [() => configurationApi.reviewBiometricCase(1, { updateStatus: "Approved" }), "PATCH", "/api/v1/biometric-update-cases/1/review", { updateStatus: "Approved" }],
    ])("write %#", async (fn, method, url, body) => {
        await fn();
        expect(call()).toMatchObject({ method, url, body });
    });

    test.each([
        [() => academicApi.listSchools({ limit: 5 }), "/api/v1/schools"],
        [() => academicApi.getSchool(2), "/api/v1/schools/2"],
        [() => academicApi.deleteSchool(2), "/api/v1/schools/2", "DELETE"],
        [() => academicApi.listPrograms(), "/api/v1/programs"],
        [() => academicApi.listSchoolPrograms(2), "/api/v1/schools/2/programs"],
        [() => academicApi.deleteProgram(3), "/api/v1/programs/3", "DELETE"],
        [() => academicApi.listPeriods(), "/api/v1/academic-periods"],
        [() => academicApi.listSchoolPeriods(2), "/api/v1/schools/2/periods"],
        [() => academicApi.deletePeriod(4), "/api/v1/academic-periods/4", "DELETE"],
        [() => academicApi.listCohorts(), "/api/v1/cohorts"],
        [() => academicApi.deleteCohort(5), "/api/v1/cohorts/5", "DELETE"],
        [() => academicApi.listCourses(), "/api/v1/courses"],
        [() => academicApi.deleteCourse(6), "/api/v1/courses/6", "DELETE"],
        [() => academicApi.listActorTypes(), "/api/v1/actor-types"],
        [() => academicApi.listActors(), "/api/v1/academic-actors"],
        [() => academicApi.deleteActor(7), "/api/v1/academic-actors/7", "DELETE"],
        [() => academicApi.listEnrollments(), "/api/v1/enrollments"],
        [() => academicApi.cohortEnrollments(5), "/api/v1/cohorts/5/enrollments"],
        [() => academicApi.deleteEnrollment(7), "/api/v1/enrollments/7", "DELETE"],
        [() => attendanceApi.listRecords({ classSessionId: 1 }), "/api/v1/attendance-records"],
        [() => attendanceApi.getRecord(8), "/api/v1/attendance-records/8"],
        [() => attendanceApi.deleteRecord(8), "/api/v1/attendance-records/8", "DELETE"],
        [() => attendanceApi.recordsByActor(10), "/api/v1/academic-actors/10/attendance"],
        [() => attendanceApi.recordsBySession(70), "/api/v1/class-sessions/70/attendance"],
        [() => attendanceApi.listJustifications(), "/api/v1/justifications"],
        [() => attendanceApi.getJustification(9), "/api/v1/justifications/9"],
        [() => attendanceApi.deleteJustification(9), "/api/v1/justifications/9", "DELETE"],
        [() => attendanceApi.listJustificationTypes(), "/api/v1/justification-types"],
        [() => attendanceApi.deleteJustificationType(1), "/api/v1/justification-types/1", "DELETE"],
        [() => attendanceApi.justificationDocuments(9), "/api/v1/justifications/9/documents"],
        [() => schedulingApi.listEnvironments(), "/api/v1/environments"],
        [() => schedulingApi.deleteEnvironment(3), "/api/v1/environments/3", "DELETE"],
        [() => schedulingApi.listBlocks(), "/api/v1/schedule-blocks"],
        [() => schedulingApi.deleteBlock(4), "/api/v1/schedule-blocks/4", "DELETE"],
        [() => schedulingApi.listSessions(), "/api/v1/class-sessions"],
        [() => schedulingApi.cancelSession(5), "/api/v1/class-sessions/5/cancel", "POST"],
        [() => authorizationApi.listRoles(), "/api/v1/roles"],
        [() => authorizationApi.getRole(1), "/api/v1/roles/1"],
        [() => authorizationApi.deleteRole(1), "/api/v1/roles/1", "DELETE"],
        [() => authorizationApi.listPermissions(), "/api/v1/permissions"],
        [() => authorizationApi.rolePermissions(1), "/api/v1/roles/1/permissions"],
        [() => authorizationApi.removePermission(1, 2), "/api/v1/roles/1/permissions/2", "DELETE"],
        [() => authorizationApi.userRoles("u1"), "/api/v1/users/u1/roles"],
        [() => authorizationApi.removeRole("u1", 3), "/api/v1/users/u1/roles/3", "DELETE"],
        [() => authorizationApi.evaluate({ userId: "u1" }), "/api/v1/auth/evaluate"],
        [() => configurationApi.listAcademic(), "/api/v1/configurations/academic"],
        [() => configurationApi.listSecurity(), "/api/v1/configurations/security"],
        [() => configurationApi.listSecurityPublic(), "/api/v1/configurations/security/public"],
        [() => configurationApi.schoolConfigurations(2), "/api/v1/schools/2/configurations"],
    ])("read/delete %#", async (fn, url, method = "GET") => {
        await fn();
        expect(call()).toMatchObject({ method, url });
    });

    test("the attendance summary joins the actor ids with commas (Spring list)", async () => {
        await attendanceApi.recordsSummary([1, 2, 3]);
        expect(call()).toMatchObject({ url: "/api/v1/attendance-records/summary", query: { academicActorIds: "1,2,3" } });
    });

    test("a support is uploaded as multipart with a longer timeout and opened as a blob", async () => {
        await attendanceApi.uploadJustificationDocument(9, new Blob(["x"]), "a.pdf");
        const [, opts] = request.mock.calls[0];
        expect(opts.body).toBeInstanceOf(FormData);
        expect(opts.timeoutMs).toBe(60000);

        await attendanceApi.supportingDocumentContent(5);
        expect(request.mock.calls[1]).toEqual(["/api/v1/supporting-documents/5/content", { method: "GET", responseType: "blob" }]);
    });

    test("biometric cases filter by status only when asked", async () => {
        await configurationApi.listBiometricCases("Pending");
        await configurationApi.listBiometricCases();
        expect(call(0).query).toEqual({ status: "Pending" });
        expect(call(1).query).toBeUndefined();
    });
});

describe("biometricCaptureApi", () => {
    test("liveness, face and fingerprint calls use the biometric timeout and snake_case bodies", async () => {
        await biometricCaptureApi.livenessChallenge(3, ["blink", "turn"]);
        await biometricCaptureApi.livenessChallenge(1);
        await biometricCaptureApi.livenessStep({ challengeToken: "t", actionIndex: 0, images: ["a"] });
        await biometricCaptureApi.enrollFace({ personId: "p", imageBase64: "img", challengeToken: "t" });
        await biometricCaptureApi.identifyFace({ imageBase64: "img", challengeToken: "t" });
        await biometricCaptureApi.enrollFingerprint({ personId: "p", fingerNumber: 2, sampleFormat: "png", data: "d", quality: 80 });
        await biometricCaptureApi.identifyFingerprint({ sampleFormat: "png", data: "d", quality: 80, fingerNumber: 2 });

        expect(request.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual([
            "GET /api/v1/biometric/facial/liveness-challenge",
            "GET /api/v1/biometric/facial/liveness-challenge",
            "POST /api/v1/biometric/facial/liveness-step",
            "POST /api/v1/biometric/facial/enroll-image",
            "POST /api/v1/biometric/facial/identify-image",
            "POST /api/v1/biometric/fingerprint/enroll-sample",
            "POST /api/v1/biometric/fingerprint/identify-sample",
        ]);
        expect(call(0).query).toEqual({ actions: 3, supported: "blink,turn" });
        expect(call(1).query).toEqual({ actions: 1 });
        expect(call(2).body).toEqual({ challenge_token: "t", action_index: 0, images: ["a"] });
        expect(call(3).body).toEqual({ person_id: "p", image_base64: "img", challenge_token: "t" });
        expect(call(5).body).toEqual({ person_id: "p", finger_number: 2, sample_format: "png", data_base64: "d", quality: 80 });
        expect(request.mock.calls.every(([, o]) => o.timeoutMs === 60000)).toBe(true);
    });

    test("deleting all biometrics revokes the face and every enrolled finger even if one fails", async () => {
        request.mockImplementation(async (url, o) => {
            if (o.method === "GET") return { templates: [{ finger_number: 1 }, { finger_number: 6 }] };
            if (url.endsWith("/1")) throw new Error("404");
            return {};
        });

        await biometricCaptureApi.deleteAllBiometrics("p");

        expect(request.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual([
            "GET /api/v1/biometric/fingerprint/p",
            "DELETE /api/v1/biometric/facial/p",
            "DELETE /api/v1/biometric/fingerprint/p/1",
            "DELETE /api/v1/biometric/fingerprint/p/6",
        ]);
    });

    test("health and summaries use short timeouts", async () => {
        await biometricCaptureApi.health();
        await biometricCaptureApi.summaryAll();
        await biometricCaptureApi.summary("p");
        expect(request.mock.calls.map(([url, o]) => [url, o.timeoutMs])).toEqual([
            ["/api/v1/biometric/health", 8000], ["/api/v1/biometric/summary", 8000], ["/api/v1/biometric/p/summary", 60000],
        ]);
    });
});

describe("fichaCreation", () => {
    test("periods of a school are normalized and rows without id dropped", async () => {
        request.mockResolvedValueOnce([{ academic_period_id: 1, name: "2026-I", starts_on: "2026-01-01", ends_on: "2026-06-30", is_active: true }, { name: "sin id" }]);
        await expect(listSchoolPeriods(2)).resolves.toEqual([{ academicPeriodId: 1, schoolId: 2, name: "2026-I", startsOn: "2026-01-01", endsOn: "2026-06-30", isActive: true }]);
        expect(call().url).toBe("/api/v1/schools/2/periods");

        request.mockResolvedValueOnce({ content: [] });
        await listSchoolPeriods(null);
        expect(call(1).url).toBe("/api/v1/academic-periods");
    });

    test("creating a period validates the school and dates and resets the cache", async () => {
        await expect(createPeriod({ schoolId: "", startsOn: "a", endsOn: "b" })).rejects.toThrow("A school is required");
        await expect(createPeriod({ schoolId: "x", startsOn: "a", endsOn: "b" })).rejects.toThrow("A school is required");
        await expect(createPeriod({ schoolId: 2, startsOn: " ", endsOn: "b" })).rejects.toThrow("Start and end dates are required");

        request.mockResolvedValueOnce({ academicPeriodId: 5 });
        await expect(createPeriod({ schoolId: "2", name: " 2026-I ", startsOn: "2026-01-01", endsOn: "2026-06-30" }))
            .resolves.toMatchObject({ academicPeriodId: 5, schoolId: 2, name: "2026-I", isActive: true });
        expect(call().body).toEqual({ schoolId: 2, name: "2026-I", startsOn: "2026-01-01", endsOn: "2026-06-30", isActive: true });
        expect(resetReferenceData).toHaveBeenCalled();
    });

    test("creating a cohort needs a program, a period and a code", async () => {
        await expect(createCohort({ programId: "x", academicPeriodId: 1, code: "F" })).rejects.toThrow("A program is required");
        await expect(createCohort({ programId: 1, academicPeriodId: null, code: "F" })).rejects.toThrow("An academic period is required");
        await expect(createCohort({ programId: 1, academicPeriodId: 1, code: " " })).rejects.toThrow("A code is required");

        request.mockResolvedValueOnce({ cohort_id: 9 });
        await expect(createCohort({ programId: "1", academicPeriodId: "2", code: " F-1 " })).resolves.toEqual({ cohortId: 9, programId: 1, academicPeriodId: 2, code: "F-1", status: true });
    });
});

describe("periodSync", () => {
    beforeEach(() => {
        saveInstitutionConfig({ ...getDefaultInstitutionConfig(), periodStartDate: "2026-07-01", periodEndDate: "2026-12-15", academicPeriodType: "semestral" });
    });

    test("helpers", () => {
        expect(todayLocalIso(new Date(2026, 9, 28, 23, 30))).toBe("2026-10-28");
        expect(periodNameFor("semestral", "2026-07-01")).toMatch(/2026$/);
        expect(periodNameFor("semestral", "x")).toBe("");
        const periods = [
            { isActive: true, startsOn: "2026-07-01", endsOn: "2026-12-15" },
            { isActive: true, startsOn: "2026-01-01", endsOn: "2026-06-30" },
            { isActive: false, startsOn: "2026-02-01", endsOn: "2027-01-01" },
        ];
        expect(currentPeriodOf(periods, "2026-10-28")).toBe(periods[0]);
        expect(currentPeriodOf([], "2026-10-28")).toBeNull();
        expect(isConfiguredPeriod(periods[0])).toBe(true);
        expect(isConfiguredPeriod(periods[1])).toBe(false);
        expect(isConfiguredPeriod(null)).toBe(false);
    });

    test("settings → academic: overlapping active periods are deactivated and the configured one created", async () => {
        request.mockImplementation(async (url, o) => {
            if (o.method === "GET") return [{ academicPeriodId: 1, isActive: true, startsOn: "2026-06-01", endsOn: "2026-08-01" }, { academicPeriodId: 2, isActive: true, startsOn: "2025-01-01", endsOn: "2025-06-30" }];
            if (o.method === "POST") return { academicPeriodId: 3, isActive: true };
            return {};
        });

        const current = await syncAcademicPeriodFromSettings(2);

        expect(current.academicPeriodId).toBe(3);
        const writes = request.mock.calls.filter(([, o]) => o.method !== "GET").map(([url, o]) => [o.method, url, o.body]);
        expect(writes).toEqual([
            ["PUT", "/api/v1/academic-periods/1", { isActive: false }],
            ["POST", "/api/v1/academic-periods", expect.objectContaining({ schoolId: 2, startsOn: "2026-07-01", endsOn: "2026-12-15", isActive: true })],
        ]);
        await expect(syncAcademicPeriodFromSettings(null)).resolves.toBeNull();
    });

    test("an existing inactive period with the configured dates is reactivated", async () => {
        request.mockImplementation(async (url, o) => (o.method === "GET" ? [{ academicPeriodId: 4, isActive: false, startsOn: "2026-07-01", endsOn: "2026-12-15" }] : {}));

        await expect(syncAcademicPeriodFromSettings(2)).resolves.toMatchObject({ academicPeriodId: 4, isActive: true });
        expect(request).toHaveBeenCalledWith("/api/v1/academic-periods/4", { method: "PUT", body: { isActive: true } });
    });

    test("academic → settings: the current period dates replace the configured ones", async () => {
        const changed = await alignSettingsWithPeriods(2, [{ isActive: true, startsOn: "2026-08-01", endsOn: "2099-12-01" }]);

        expect(changed).toBe(true);
        expect(getInstitutionConfig()).toMatchObject({ periodStartDate: "2026-08-01", periodEndDate: "2099-12-01" });
        expect(pushInstitutionConfig).toHaveBeenCalledWith(2, { periodStartDate: "2026-08-01", periodEndDate: "2099-12-01" }, { canWriteSecurity: false });
        await expect(alignSettingsWithPeriods(2, [])).resolves.toBe(false);
    });
});
