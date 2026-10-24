import { isValidEmail } from "../validation";
import { trimDashes } from "../formatting";

const BUDGET_MS = 250;
const timed = (fn) => {
    const start = Date.now();
    const result = fn();
    return { result, ms: Date.now() - start };
};

describe("isValidEmail", () => {
    it.each(["user@example.com", "a.b+tag@sub.example.co", "x@y.z"])("accepts %s", (email) => {
        expect(isValidEmail(email)).toBe(true);
    });

    it.each(["", null, "invalid", "a@b", "a@@b.com", "a b@c.com", "a@b c.com", "@b.com", "a@.com", "a@b."])(
        "rejects %p",
        (email) => {
            expect(isValidEmail(email)).toBe(false);
        },
    );

    it("rejects empty domain labels", () => {
        expect(isValidEmail("a@b..c")).toBe(false);
    });

    it("stays linear on a long adversarial domain", () => {
        const { result, ms } = timed(() => isValidEmail(`a@${".".repeat(60000)} `));
        expect(result).toBe(false);
        expect(ms).toBeLessThan(BUDGET_MS);
    });
});

describe("trimDashes", () => {
    it("strips leading and trailing dashes only", () => {
        expect(trimDashes("--hola-mundo--")).toBe("hola-mundo");
        expect(trimDashes("a-b")).toBe("a-b");
        expect(trimDashes("---")).toBe("");
        expect(trimDashes("")).toBe("");
    });

    it("stays linear on a long run of dashes followed by a letter", () => {
        const { result, ms } = timed(() => trimDashes(`${"-".repeat(60000)}a${"-".repeat(10)}x`));
        expect(result).toBe(`a${"-".repeat(10)}x`);
        expect(ms).toBeLessThan(BUDGET_MS);
    });
});
