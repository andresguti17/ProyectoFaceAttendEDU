import {
    profileFormFrom,
    emailChanged,
    hasProfileChanges,
    validateProfile,
    buildProfilePayload,
    mapProfileError,
} from "../profileForm";

const person = {
    name: "Ana",
    lastName: "Pérez",
    documentNumber: "123",
    email: "ana@colegio.edu",
    phone: "3000000000",
    address: "Calle 1",
    birthDate: "2000-05-17",
    bloodType: "O+",
};

describe("profileFormFrom", () => {
    it("takes only the editable fields and an empty current password", () => {
        expect(profileFormFrom(person)).toEqual({
            phone: "3000000000",
            address: "Calle 1",
            birthDate: "2000-05-17",
            bloodType: "O+",
            email: "ana@colegio.edu",
            currentPassword: "",
        });
    });

    it("uses empty strings for missing values", () => {
        expect(profileFormFrom({ email: "a@b.co" })).toMatchObject({ phone: "", address: "", birthDate: "", bloodType: "" });
    });
});

describe("change detection", () => {
    it("is false for an untouched form and ignores the password and email case", () => {
        const values = { ...profileFormFrom(person), email: "ANA@colegio.edu", currentPassword: "x" };
        expect(hasProfileChanges(values, person)).toBe(false);
        expect(emailChanged(values, person)).toBe(false);
    });

    it("is true when an editable field or the email changes", () => {
        expect(hasProfileChanges({ ...profileFormFrom(person), phone: "3111111111" }, person)).toBe(true);
        expect(hasProfileChanges({ ...profileFormFrom(person), email: "otra@colegio.edu" }, person)).toBe(true);
    });
});

describe("validateProfile", () => {
    const base = profileFormFrom(person);

    it("accepts the stored data as is", () => {
        expect(validateProfile(base, person)).toEqual({});
    });

    it("rejects malformed optional fields only when filled", () => {
        expect(validateProfile({ ...base, phone: "123" }, person).phone).toBeDefined();
        expect(validateProfile({ ...base, phone: "" }, person)).toEqual({});
        expect(validateProfile({ ...base, birthDate: "17/05/2000" }, person).birthDate).toBeDefined();
        expect(validateProfile({ ...base, birthDate: "2000-02-31" }, person).birthDate).toBeDefined();
        expect(validateProfile({ ...base, birthDate: "2999-01-01" }, person).birthDate).toBeDefined();
        expect(validateProfile({ ...base, birthDate: "" }, person)).toEqual({});
        expect(validateProfile({ ...base, bloodType: "Z+" }, person).bloodType).toBeDefined();
    });

    it("requires a valid email, and the current password when it changes", () => {
        expect(validateProfile({ ...base, email: "" }, person).email).toBeDefined();
        expect(validateProfile({ ...base, email: "no-es-correo" }, person).email).toBeDefined();
        const changed = { ...base, email: "nueva@colegio.edu" };
        expect(validateProfile(changed, person).currentPassword).toBeDefined();
        expect(validateProfile({ ...changed, currentPassword: "Secret123!" }, person)).toEqual({});
    });
});

describe("buildProfilePayload", () => {
    it("always sends the editable fields and no email when it did not change", () => {
        const payload = buildProfilePayload({ ...profileFormFrom(person), phone: " 3111111111 ", address: "" }, person);
        expect(payload).toEqual({ phone: "3111111111", address: "", birthDate: "2000-05-17", bloodType: "O+" });
        expect(payload).not.toHaveProperty("email");
        expect(payload).not.toHaveProperty("currentPassword");
    });

    it("sends birthDate null when cleared", () => {
        expect(buildProfilePayload({ ...profileFormFrom(person), birthDate: "" }, person).birthDate).toBeNull();
    });

    it("adds the lowercase email and the current password when the email changed", () => {
        const payload = buildProfilePayload(
            { ...profileFormFrom(person), email: " Nueva@Colegio.edu ", currentPassword: "Secret123!" },
            person
        );
        expect(payload.email).toBe("nueva@colegio.edu");
        expect(payload.currentPassword).toBe("Secret123!");
    });

    it("never carries names, document or status", () => {
        const keys = Object.keys(buildProfilePayload({ ...profileFormFrom(person), email: "x@y.co", currentPassword: "p" }, person));
        expect(keys.sort()).toEqual(["bloodType", "birthDate", "address", "currentPassword", "email", "phone"].sort());
    });
});

describe("mapProfileError", () => {
    it("points a duplicated email at the email field", () => {
        expect(mapProfileError({ status: 409 })).toMatchObject({ field: "email" });
    });

    it("points a wrong current password at its field", () => {
        expect(mapProfileError({ status: 400, message: "Current password is incorrect" })).toMatchObject({
            field: "currentPassword",
        });
    });

    it("uses a general message for other failures", () => {
        expect(mapProfileError({ status: 0 }).message).toMatch(/conectar/);
        expect(mapProfileError({ status: 500 }).field).toBeNull();
        expect(mapProfileError({ status: 400, message: "birthDate cannot be in the future" }).message).toMatch(/future/);
    });
});
