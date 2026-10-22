import { fingerprintQualityCode, fingerprintQualityMessage } from "../fingerprintQuality";

describe("fingerprintQualityMessage (SDK QualityCode -> what to fix)", () => {
    test("a good capture has nothing to fix", () => {
        expect(fingerprintQualityMessage(0)).toBeNull();
        expect(fingerprintQualityMessage(null)).toBeNull();
    });

    test("each known problem says what to do", () => {
        expect(fingerprintQualityMessage(7)).toMatch(/centrado/i); // NotCentered
        expect(fingerprintQualityMessage(21)).toMatch(/húmedo/i); // WetFinger
        expect(fingerprintQualityMessage(22)).toMatch(/falso/i); // FakeFinger
    });

    test("every code the SDK defines (1..24) has its own message", () => {
        const messages = new Set();
        for (let code = 1; code <= 24; code += 1) {
            const message = fingerprintQualityMessage(code);
            expect(message).toBeTruthy();
            expect(message).not.toMatch(/código/); // not the generic fallback
            messages.add(message);
        }
        expect(messages.size).toBeGreaterThan(20);
    });

    test("an unknown code still explains that the reader reported a problem", () => {
        expect(fingerprintQualityMessage(99)).toMatch(/código 99/);
    });
});

test("reads the code from the SDK event", () => {
    expect(fingerprintQualityCode({ quality: 7 })).toBe(7);
    expect(fingerprintQualityCode({ quality: 0 })).toBe(0);
    expect(fingerprintQualityCode({})).toBeNull();
});
