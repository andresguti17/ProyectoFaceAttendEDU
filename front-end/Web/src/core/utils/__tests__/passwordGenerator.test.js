import { generateTemporaryPassword } from "../passwordGenerator";
import { checkPassword } from "../validation";

describe("generateTemporaryPassword", () => {
    it("has the requested length with a floor of 8", () => {
        expect(generateTemporaryPassword(14)).toHaveLength(14);
        expect(generateTemporaryPassword(3)).toHaveLength(8);
        expect(generateTemporaryPassword()).toHaveLength(12);
    });

    it("always contains upper, lower, digit and symbol and passes the password policy", () => {
        for (let i = 0; i < 200; i += 1) {
            const password = generateTemporaryPassword();
            expect(password).toMatch(/[A-Z]/);
            expect(password).toMatch(/[a-z]/);
            expect(password).toMatch(/[0-9]/);
            expect(password).toMatch(/[!@#$%&*?]/);
            expect(checkPassword(password, {}).isValid).toBe(true);
        }
    });

    it("avoids ambiguous characters", () => {
        for (let i = 0; i < 200; i += 1) {
            expect(generateTemporaryPassword(30)).not.toMatch(/[0OIl1]/);
        }
    });

    it("does not repeat across calls", () => {
        const seen = new Set(Array.from({ length: 100 }, () => generateTemporaryPassword()));
        expect(seen.size).toBe(100);
    });
});
