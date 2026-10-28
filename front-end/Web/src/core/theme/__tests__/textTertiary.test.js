import tinycolor from "tinycolor2";
import { generateTheme } from "../generateTheme";

// 44 places paint hints, timestamps and meta text with `colors.text.tertiary`.
// The token must exist and stay readable (WCAG AA 4.5:1 for small text) on the
// app and card backgrounds, in both modes and with any accent color.
describe("text.tertiary", () => {
    for (const mode of ["light", "dark"]) {
        for (const accent of ["#2563EB", "#FDE047", "#0B1F4B"]) {
            it(`is defined and readable in ${mode} mode with accent ${accent}`, () => {
                const { colors } = generateTheme(accent, mode);
                expect(colors.text.tertiary).toMatch(/^#[0-9A-F]{6}$/i);
                for (const background of [colors.background.app, colors.background.surface]) {
                    expect(tinycolor.readability(colors.text.tertiary, background)).toBeGreaterThanOrEqual(4.5);
                }
            });
        }
    }

    it("never reads stronger than the secondary text", () => {
        for (const mode of ["light", "dark"]) {
            const { colors } = generateTheme("#2563EB", mode);
            const surface = colors.background.surface;
            expect(tinycolor.readability(colors.text.tertiary, surface))
                .toBeLessThanOrEqual(tinycolor.readability(colors.text.secondary, surface));
        }
    });
});
