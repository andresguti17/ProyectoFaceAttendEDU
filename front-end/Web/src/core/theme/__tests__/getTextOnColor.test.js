import { generateTheme, getTextOnColor } from "../generateTheme";

describe("getTextOnColor", () => {
    it("usa texto oscuro sobre fondos claros y claro sobre fondos oscuros", () => {
        expect(getTextOnColor("#FDE047")).toBe("#0F172A");
        expect(getTextOnColor("#FFFFFF")).toBe("#0F172A");
        expect(getTextOnColor("#0B1F4B")).toBe("#FFFFFF");
        expect(getTextOnColor("#000000")).toBe("#FFFFFF");
    });

    it("coincide con los tokens *Text que genera el tema", () => {
        for (const accent of ["#2563EB", "#FDE047", "#0B1F4B"]) {
            for (const mode of ["light", "dark"]) {
                const { colors } = generateTheme(accent, mode);
                expect(colors.brand.textOnPrimary).toBe(getTextOnColor(colors.brand.primary));
                expect(colors.status.errorText).toBe(getTextOnColor(colors.status.error));
                expect(colors.status.successText).toBe(getTextOnColor(colors.status.success));
                expect(colors.status.warningText).toBe(getTextOnColor(colors.status.warning));
            }
        }
    });
});
