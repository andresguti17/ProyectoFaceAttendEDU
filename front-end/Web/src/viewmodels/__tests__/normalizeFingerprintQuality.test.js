import { normalizeFingerprintQuality } from "../useFingerprintReader";

describe("normalizeFingerprintQuality (SDK QualityCode -> service score)", () => {
    test("Good (code 0) becomes the best score, not 0 — it used to be rejected as 'quality too low'", () => {
        expect(normalizeFingerprintQuality({ quality: 0 })).toBe(100);
    });

    test.each([1, 2, 3, 7, 22, 24])("problem code %i becomes the worst score", (code) => {
        expect(normalizeFingerprintQuality({ quality: code })).toBe(0);
    });

    test("an unreadable event yields no score instead of a wrong one", () => {
        expect(normalizeFingerprintQuality({})).toBeNull();
        expect(normalizeFingerprintQuality({ quality: "mala" })).toBeNull();
        expect(normalizeFingerprintQuality({ quality: -1 })).toBeNull();
    });
});
