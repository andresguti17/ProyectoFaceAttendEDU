import { generateTheme } from "../../../../../core/theme/generateTheme";
import { getButtonColors, BUTTON_VARIANTS } from "../buttonColors";

// Tres acentos de la paleta: azul de marca, un amarillo muy claro y un azul marino oscuro.
const ACCENTS = ["#2563EB", "#FDE047", "#0B1F4B"];
const MODES = ["light", "dark"];

describe.each(ACCENTS.flatMap((accent) => MODES.map((mode) => [accent, mode])))(
    "getButtonColors con acento %s en modo %s",
    (accent, mode) => {
        const { colors } = generateTheme(accent, mode);

        it("primary usa brand.primary con brand.textOnPrimary", () => {
            expect(getButtonColors(colors, "primary")).toEqual({
                backgroundColor: colors.brand.primary,
                borderColor: colors.brand.primary,
                color: colors.brand.textOnPrimary,
                opacity: 1,
            });
        });

        it("secondary usa brand.primaryLight con texto brand.primary", () => {
            const s = getButtonColors(colors, "secondary");
            expect(s.backgroundColor).toBe(colors.brand.primaryLight);
            expect(s.color).toBe(colors.brand.primary);
        });

        it("outline es transparente con borde y texto brand.primary", () => {
            expect(getButtonColors(colors, "outline")).toMatchObject({
                backgroundColor: "transparent",
                borderColor: colors.brand.primary,
                color: colors.brand.primary,
            });
        });

        it("ghost es transparente con texto text.primary", () => {
            expect(getButtonColors(colors, "ghost")).toMatchObject({
                backgroundColor: "transparent",
                borderColor: "transparent",
                color: colors.text.primary,
            });
        });

        it.each([
            ["danger", "error", "errorText"],
            ["success", "success", "successText"],
            ["warning", "warning", "warningText"],
        ])("%s usa status.%s con status.%s", (variant, bg, fg) => {
            expect(getButtonColors(colors, variant)).toMatchObject({
                backgroundColor: colors.status[bg],
                color: colors.status[fg],
            });
        });

        it("inverse e inverseOutline pintan sobre fondos de marca con brand.textOnPrimary", () => {
            expect(getButtonColors(colors, "inverse")).toMatchObject({
                backgroundColor: colors.brand.textOnPrimary,
                color: colors.brand.primary,
            });
            expect(getButtonColors(colors, "inverseOutline")).toMatchObject({
                backgroundColor: "transparent",
                borderColor: colors.brand.textOnPrimary,
                color: colors.brand.textOnPrimary,
            });
        });

        it("deshabilitado usa interactive.disabled / disabledText en todas las variantes", () => {
            for (const variant of BUTTON_VARIANTS) {
                const d = getButtonColors(colors, variant, { disabled: true });
                expect(d.color).toBe(colors.interactive.disabledText);
                expect(d.opacity).toBe(1);
                if (variant === "outline" || variant === "ghost" || variant === "inverseOutline") {
                    expect(d.backgroundColor).toBe("transparent");
                } else {
                    expect(d.backgroundColor).toBe(colors.interactive.disabled);
                }
            }
        });

        it("hover y pulsado tiñen los transparentes y atenúan los rellenos sin cambiar el texto", () => {
            const hoverOutline = getButtonColors(colors, "outline", { hovered: true });
            const pressedGhost = getButtonColors(colors, "ghost", { pressed: true });
            expect(hoverOutline.backgroundColor).toBe(colors.interactive.hover);
            expect(pressedGhost.backgroundColor).toBe(colors.interactive.pressed);

            const idle = getButtonColors(colors, "primary");
            const hover = getButtonColors(colors, "primary", { hovered: true });
            const pressed = getButtonColors(colors, "primary", { pressed: true });
            expect(hover.backgroundColor).toBe(idle.backgroundColor);
            expect(hover.color).toBe(idle.color);
            expect(hover.opacity).toBeLessThan(1);
            expect(pressed.opacity).toBeLessThan(hover.opacity);
        });

        it("una variante desconocida cae en primary", () => {
            expect(getButtonColors(colors, "nope")).toEqual(getButtonColors(colors, "primary"));
        });
    }
);

describe("los botones siguen la paleta elegida", () => {
    it("cambiar el acento cambia el color del botón primario y de outline", () => {
        const a = generateTheme("#2563EB", "light").colors;
        const b = generateTheme("#16A34A", "light").colors;
        expect(getButtonColors(a, "primary").backgroundColor).not.toBe(getButtonColors(b, "primary").backgroundColor);
        expect(getButtonColors(a, "outline").borderColor).not.toBe(getButtonColors(b, "outline").borderColor);
    });

    it("el texto del primario se adapta a un acento claro", () => {
        const light = generateTheme("#FDE047", "light").colors;
        const dark = generateTheme("#0B1F4B", "light").colors;
        expect(getButtonColors(light, "primary").color).not.toBe(getButtonColors(dark, "primary").color);
    });
});
