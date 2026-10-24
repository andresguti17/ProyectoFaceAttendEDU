import assert from "node:assert/strict";
import { test } from "node:test";
import { REQUIRED_PASSWORD_VARS, resolveSeedCredentials } from "./credentials.mjs";

const full = Object.fromEntries(REQUIRED_PASSWORD_VARS.map((name) => [name, `${name}-value`]));

test("lists every missing password variable at once", () => {
    assert.throws(
        () => resolveSeedCredentials({}),
        (error) => REQUIRED_PASSWORD_VARS.every((name) => error.message.includes(name)),
    );
});

test("treats blank values as missing", () => {
    assert.throws(() => resolveSeedCredentials({ ...full, TEACHER_PASSWORD: "   " }), /TEACHER_PASSWORD/);
});

test("takes passwords only from the environment", () => {
    const credentials = resolveSeedCredentials(full);
    assert.equal(credentials.adminPassword, "SEED_PASSWORD-value");
    assert.equal(credentials.instructorPassword, "INSTRUCTOR_PASSWORD-value");
    assert.equal(credentials.studentPassword, "STUDENT_PASSWORD-value");
    assert.equal(credentials.teacherPassword, "TEACHER_PASSWORD-value");
    assert.equal(credentials.schoolAdminPassword, "SCHOOL_ADMIN_PASSWORD-value");
});

test("usernames keep their non-secret defaults and can be overridden", () => {
    assert.equal(resolveSeedCredentials(full).adminUsername, "carolina.mendoza");
    assert.equal(resolveSeedCredentials({ ...full, SEED_USERNAME: "otra.persona" }).adminUsername, "otra.persona");
});
