import { evaluateColor, hexToRgb } from "../colorUtils";

// Veredictos capturados antes de leer los canales con hexToRgb.
const verdictOf = (hex) => {
    const { wcagLevel, score, contrastRatio } = evaluateColor(hex, (text) => text);
    return `${wcagLevel}/${score}/${contrastRatio}`;
};

test("evaluateColor keeps its verdict for known colors", () => {
    const hexes = ["#000000", "#FFFFFF", "#1E90FF", "#FFD700", "#808080", "#8B0000"];
    expect(hexes.map(verdictOf)).toEqual([
        "AAA/aceptable/21",
        "AAA/aceptable/21",
        "AA/bueno/6.5",
        "AAA/aceptable/15",
        "AA/aceptable/5.3",
        "AAA/excelente/10",
    ]);
});

test("hexToRgb reads the three channels", () => {
    expect(hexToRgb("#1E90FF")).toEqual({ r: 30, g: 144, b: 255 });
});
