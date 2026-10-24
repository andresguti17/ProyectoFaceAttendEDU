import { evaluateColor, hexToRgb } from "../colorUtils";

// Valores capturados antes de quitar la lectura de canales duplicada, para
// comprobar que el refactor no cambia ningún veredicto.
const t = (s) => s;

const EXPECTED = {
    "#000000": {
        "score": "aceptable",
        "scoreColor": "warning",
        "readability": "Texto blanco encima se ve perfecto",
        "vibe": "Tono neutro — discreto, no llama la atención",
        "uiFit": "Muy oscuro — puede confundirse con el texto",
        "tip": "Este color funciona bien — no necesita ajustes",
        "contrastRatio": 21,
        "wcagLevel": "AAA"
    },
    "#FFFFFF": {
        "score": "aceptable",
        "scoreColor": "warning",
        "readability": "Texto blanco encima no se lee bien — este color es demasiado claro",
        "vibe": "Tono neutro — discreto, no llama la atención",
        "uiFit": "Muy claro — puede perderse sobre fondos blancos",
        "tip": "Baja la luminosidad 15–20 puntos para que el texto blanco sea legible",
        "contrastRatio": 21,
        "wcagLevel": "AAA"
    },
    "#1E90FF": {
        "score": "bueno",
        "scoreColor": "success",
        "readability": "Texto blanco se ve, pero cuesta leerlo — mejor usar texto oscuro",
        "vibe": "Azul — profesional, genera confianza",
        "uiFit": "Proporciones equilibradas — ideal para botones, tabs y bordes",
        "tip": "Baja la luminosidad 8–10 puntos para mejorar la legibilidad",
        "contrastRatio": 6.5,
        "wcagLevel": "AA"
    },
    "#FFD700": {
        "score": "aceptable",
        "scoreColor": "warning",
        "readability": "Texto blanco encima no se lee bien — este color es demasiado claro",
        "vibe": "Naranja / dorado — cálido y amigable",
        "uiFit": "Proporciones equilibradas — ideal para botones, tabs y bordes",
        "tip": "Este color funciona bien — no necesita ajustes",
        "contrastRatio": 15,
        "wcagLevel": "AAA"
    },
    "#808080": {
        "score": "aceptable",
        "scoreColor": "warning",
        "readability": "Texto blanco se ve, pero cuesta leerlo — mejor usar texto oscuro",
        "vibe": "Tono neutro — discreto, no llama la atención",
        "uiFit": "Poco saturado — funciona como neutro, pero puede pasar desapercibido",
        "tip": "Este color funciona bien — no necesita ajustes",
        "contrastRatio": 5.3,
        "wcagLevel": "AA"
    },
    "#8B0000": {
        "score": "excelente",
        "scoreColor": "success",
        "readability": "Texto blanco encima se ve perfecto",
        "vibe": "Rojo — enérgico y llamativo, úsalo con moderación",
        "uiFit": "Proporciones equilibradas — ideal para botones, tabs y bordes",
        "tip": "Este color funciona bien — no necesita ajustes",
        "contrastRatio": 10,
        "wcagLevel": "AAA"
    }
};

describe("evaluateColor (Web)", () => {
    it.each(Object.keys(EXPECTED))("keeps the verdict for %s", (hex) => {
        expect(evaluateColor(hex, t)).toEqual(EXPECTED[hex]);
    });
});

describe("hexToRgb", () => {
    it("reads the three channels", () => {
        expect(hexToRgb("#1E90FF")).toEqual({"r":30,"g":144,"b":255});
    });
});
