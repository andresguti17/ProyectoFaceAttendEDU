import {
    EMPTY_FORM,
    validateSchoolStep,
    validateAdminStep,
    buildOnboardingPayload,
    mapOnboardingError,
    normalizeSchoolCode,
    normalizeUsername,
    onlyLettersAndSpaces,
} from "../schoolSignup";

const validForm = {
    ...EMPTY_FORM,
    code: "CIES-009",
    name: "Colegio Nuevo",
    cityName: "Bogotá",
    documentType: "CC",
    documentNumber: "123456",
    adminName: "Ana",
    adminLastName: "Pérez",
    adminEmail: "ana@colegio.edu",
    username: "ana.perez",
    password: "Str0ng!Passw0rd#",
    confirmPassword: "Str0ng!Passw0rd#",
    privacyAccepted: true,
    biometricAccepted: false,
};

describe("input normalizers", () => {
    it("uppercases the school code and drops invalid characters", () => {
        expect(normalizeSchoolCode("cies 009_x")).toBe("CIES009X");
    });

    it("lowercases the username and drops spaces and symbols", () => {
        expect(normalizeUsername("Ana Pérez!")).toBe("anaprez");
    });

    it("keeps accents in names but drops digits", () => {
        expect(onlyLettersAndSpaces("María 2 José")).toBe("María  José");
    });
});

describe("validateSchoolStep", () => {
    it("accepts the minimum required school data", () => {
        expect(validateSchoolStep(validForm)).toEqual({});
    });

    it("requires code, name and city", () => {
        const errors = validateSchoolStep(EMPTY_FORM);
        expect(Object.keys(errors).sort()).toEqual(["cityName", "code", "name"]);
    });

    it("rejects malformed optional fields only when filled", () => {
        const errors = validateSchoolStep({ ...validForm, phone: "123", email: "no-es-correo" });
        expect(errors.phone).toBeDefined();
        expect(errors.email).toBeDefined();
        expect(validateSchoolStep({ ...validForm, phone: "", email: "" })).toEqual({});
    });
});

describe("validateAdminStep", () => {
    it("accepts a complete administrator", () => {
        expect(validateAdminStep(validForm)).toEqual({});
    });

    it("requires the document type to be one of CC/TI/CE/PP", () => {
        expect(validateAdminStep({ ...validForm, documentType: "XX" }).documentType).toBeDefined();
        expect(validateAdminStep({ ...validForm, documentType: "PP" }).documentType).toBeUndefined();
    });

    it("requires the confirmation to match the password", () => {
        const errors = validateAdminStep({ ...validForm, confirmPassword: "otra" });
        expect(errors.confirmPassword).toBeDefined();
        expect(errors.password).toBeUndefined();
    });

    it("rejects a weak password", () => {
        expect(validateAdminStep({ ...validForm, password: "abc", confirmPassword: "abc" }).password).toBeDefined();
    });

    it("rejects a username with uppercase letters or spaces", () => {
        expect(validateAdminStep({ ...validForm, username: "Ana Perez" }).username).toBeDefined();
    });
});

describe("buildOnboardingPayload", () => {
    it("splits the form into school and admin and trims values", () => {
        const payload = buildOnboardingPayload({ ...validForm, code: " CIES-009 ", adminName: " Ana " });
        expect(payload.school.code).toBe("CIES-009");
        expect(payload.admin.name).toBe("Ana");
        expect(payload.admin.lastName).toBe("Pérez");
        expect(payload.admin.documentType).toBe("CC");
        expect(payload.admin.password).toBe("Str0ng!Passw0rd#");
        expect(payload.admin.privacyPolicyVersion).toBe("2026-10");
        expect(payload.admin.biometricAccepted).toBe(false);
    });

    it("requires the privacy notice before the administrator step is valid (Ley 1581)", () => {
        expect(validateAdminStep({ ...validForm, privacyAccepted: false }).privacyAccepted).toBeDefined();
    });

    it("omits empty optional fields and never sends the confirmation", () => {
        const wire = JSON.parse(JSON.stringify(buildOnboardingPayload(validForm)));
        expect(wire.school).not.toHaveProperty("address");
        expect(wire.school).not.toHaveProperty("phone");
        expect(wire.admin).not.toHaveProperty("phone");
        expect(JSON.stringify(wire)).not.toContain("confirmPassword");
    });
});

describe("mapOnboardingError", () => {
    it("points a duplicated school code at the code field in step 1", () => {
        const r = mapOnboardingError({ status: 409, message: "School already exists with value=CIES-009" });
        expect(r).toMatchObject({ field: "code", step: 1 });
    });

    it("points a duplicated username at the username field in step 2", () => {
        const r = mapOnboardingError({ status: 409, message: "User already exists with value=ana.perez" });
        expect(r).toMatchObject({ field: "username", step: 2 });
    });

    it("shows a general message for other conflicts and for unavailable service", () => {
        expect(mapOnboardingError({ status: 409, message: "Resource violates a uniqueness constraint" }).field).toBeNull();
        expect(mapOnboardingError({ status: 503 }).message).toMatch(/no está disponible/);
        expect(mapOnboardingError({ status: 429 }).message).toMatch(/Demasiados intentos/);
        expect(mapOnboardingError({ status: 0 }).message).toMatch(/conectar/);
    });
});
