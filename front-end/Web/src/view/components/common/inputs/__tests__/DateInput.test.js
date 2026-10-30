// ============================================================
//  DateInput — máscara de fecha compartida por todos los campos
//  de fecha de la app. Se simula el tecleo dígito a dígito: cada
//  pulsación añade un carácter al valor que el campo muestra.
// ============================================================

import { formatDateValue, toInternalFormat, fromInternalFormat } from "../DateInput";

/** Teclea `digits` uno a uno sobre el campo y devuelve lo que se ve. */
function type(digits, format) {
    let shown = "";
    for (const d of digits) shown = formatDateValue(shown + d, format);
    return shown;
}

describe("DateInput — tecleo", () => {
    test("día y mes con cero inicial (DD/MM/YYYY)", () => {
        const shown = type("05032005", "DD/MM/YYYY");
        expect(shown).toBe("05/03/2005");
        expect(toInternalFormat(shown, "DD/MM/YYYY")).toBe("2005-03-05");
    });

    test("un 0 suelto no se convierte en 01", () => {
        expect(type("0", "DD/MM/YYYY")).toBe("0");
        expect(type("150", "DD/MM/YYYY")).toBe("15/0");
    });

    test("00 sí se corrige a 01", () => {
        expect(type("00", "DD/MM/YYYY")).toBe("01");
        expect(type("1500", "DD/MM/YYYY")).toBe("15/01");
    });

    test("MM/DD/YYYY", () => {
        const shown = type("03052005", "MM/DD/YYYY");
        expect(shown).toBe("03/05/2005");
        expect(toInternalFormat(shown, "MM/DD/YYYY")).toBe("2005-03-05");
    });

    test("YYYY-MM-DD", () => {
        const shown = type("20050305", "YYYY-MM-DD");
        expect(shown).toBe("2005-03-05");
        expect(toInternalFormat(shown, "YYYY-MM-DD")).toBe("2005-03-05");
    });

    test("día fuera del mes se ajusta al último día", () => {
        expect(type("31022005", "DD/MM/YYYY")).toBe("28/02/2005");
        expect(type("13", "MM/DD/YYYY")).toBe("12");
    });

    test("fecha incompleta emite el valor parcial (el formulario la rechaza)", () => {
        expect(toInternalFormat(type("0503", "DD/MM/YYYY"), "DD/MM/YYYY")).toBe("03-05");
        expect(toInternalFormat("", "DD/MM/YYYY")).toBe("");
    });

    test("valor interno a formato configurado", () => {
        expect(fromInternalFormat("2005-03-05", "DD/MM/YYYY")).toBe("05/03/2005");
        expect(fromInternalFormat("2005-03-05", "MM/DD/YYYY")).toBe("03/05/2005");
        expect(fromInternalFormat("2005-03", "DD/MM/YYYY")).toBe("");
    });
});
