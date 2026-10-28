import { birthDateError } from "../validation";

const TODAY = new Date(2026, 9, 28); // 28/10/2026

describe("birthDateError", () => {
    test("vacía es válida (el campo es opcional)", () => {
        expect(birthDateError("", TODAY)).toBeNull();
        expect(birthDateError(undefined, TODAY)).toBeNull();
    });

    test("fecha real en el pasado", () => {
        expect(birthDateError("2005-03-05", TODAY)).toBeNull();
        expect(birthDateError("2026-10-28", TODAY)).toBeNull(); // hoy
    });

    test("incompleta o con otro formato", () => {
        expect(birthDateError("2005-03", TODAY)).toMatch(/incompleta/);
        expect(birthDateError("05/03/2005", TODAY)).toMatch(/incompleta/);
    });

    test("fecha inexistente en el calendario", () => {
        expect(birthDateError("2005-02-30", TODAY)).toMatch(/no es válida/);
        expect(birthDateError("2001-02-29", TODAY)).toMatch(/no es válida/);
    });

    test("fuera de rango", () => {
        expect(birthDateError("2026-10-29", TODAY)).toMatch(/futura/);
        expect(birthDateError("1899-12-31", TODAY)).toMatch(/1900/);
    });
});
