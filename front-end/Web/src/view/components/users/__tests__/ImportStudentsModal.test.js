// ============================================================
//  Tests del parser de ImportStudentsModal (importStudentsParser)
//  Cubre los formatos que fallaban en "Importar estudiantes":
//  - CSV con "," (happy path)
//  - CSV con ";" + BOM UTF-8 (export de Excel en español)
//  - .xlsx binario (ExcelJS)
//  - Plantilla real sin course/grade y con documentNumber/password
// ============================================================

import { importOutcome, parseFileContent, targetCourseItems } from "../importStudentsParser";
import ExcelJS from "exceljs";

/** A real .xlsx file with `rows` on its first sheet. */
async function xlsxOf(rows) {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Hoja1").addRows(rows);
    return workbook.xlsx.writeBuffer();
}

const HEADERS = ["name", "code", "email", "course", "grade"];

const expectOneRow = (result) => {
    expect(result.errors).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
        name: "Ana García",
        code: "EST-1001",
        email: "ana@mail.com",
        course: "ADSI",
        grade: "3",
    });
};

describe("ImportStudentsModal — parseFileContent", () => {
    test("CSV con comas", async () => {
        const csv = [
            HEADERS.join(","),
            '"Ana García",EST-1001,ana@mail.com,ADSI,3',
        ].join("\n");
        expectOneRow(await parseFileContent("estudiantes.csv", csv));
    });

    test("CSV con punto y coma y BOM UTF-8 (Excel español)", async () => {
        const csv = "\uFEFF" + [
            HEADERS.join(";"),
            "Ana García;EST-1001;ana@mail.com;ADSI;3",
        ].join("\r\n");
        expectOneRow(await parseFileContent("estudiantes.csv", csv));
    });

    test("CSV con comas dentro de comillas", async () => {
        const csv = [
            HEADERS.join(","),
            '"García, Ana",EST-1001,ana@mail.com,ADSI,3',
        ].join("\n");
        const result = await parseFileContent("estudiantes.csv", csv);
        expect(result.errors).toBe(0);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toMatchObject({
            name: "García, Ana", // la coma no parte la columna
            code: "EST-1001",
            email: "ana@mail.com",
            course: "ADSI",
            grade: "3",
        });
    });

    test(".xlsx binario se parsea con ExcelJS", async () => {
        const buf = await xlsxOf([
            HEADERS,
            ["Ana García", "EST-1001", "ana@mail.com", "ADSI", "3"],
        ]);
        expectOneRow(await parseFileContent("estudiantes.xlsx", buf));
    });

    test("filas incompletas se contabilizan como error, no se descartan en silencio", async () => {
        const csv = [
            HEADERS.join(","),
            "Ana García,EST-1001,ana@mail.com,ADSI,3",
            ",EST-1002,,, ,",
        ].join("\n");
        const result = await parseFileContent("estudiantes.csv", csv);
        expect(result.rows).toHaveLength(1);
        expect(result.errors).toBe(1);
    });

    test("líneas con # son comentarios (la plantilla trae una nota) y no cuentan como error", async () => {
        const csv = [
            HEADERS.join(","),
            "Ana García,EST-1001,ana@mail.com,ADSI,3",
            "# Nota: código = códigoCurso + 00 + nnn",
        ].join("\n");
        const result = await parseFileContent("estudiantes.csv", csv);
        expect(result.rows).toHaveLength(1);
        expect(result.errors).toBe(0);
    });

    // Formato real de plantilla: ";" con course/grade vacíos, más las
    // columnas documentNumber/password y estado en español ("Pendiente
    // de validar" no es "inactive" ⇒ active).
    test("plantilla real: course/grade vacíos, con documentNumber y password", async () => {
        const headers = [
            "name", "code", "email", "course", "grade", "documentNumber",
            "password", "attendance", "status", "hasFacial", "hasFingerprint",
        ];
        const csv = "\uFEFF" + [
            headers.join(";"),
            "JUSTIN BAHAMON;1015407712;justin@ejemplo.com;;;1015407712;;;Pendiente de validar;No;No",
        ].join("\r\n");
        const result = await parseFileContent("plantilla_estudiantes.csv", csv);
        expect(result.errors).toBe(0);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toMatchObject({
            name: "JUSTIN BAHAMON",
            code: "1015407712",
            email: "justin@ejemplo.com",
            course: "",
            grade: "",
            documentNumber: "1015407712",
            password: "",
            status: "active",
            hasFacial: false,
            hasFingerprint: false,
        });
    });

    test("code vacío se completa con documentNumber y se respeta password", async () => {
        const csv = [
            "name,email,documentNumber,password",
            "Ana García,ana@mail.com,12345,ClaveFila123!",
        ].join("\n");
        const result = await parseFileContent("estudiantes.csv", csv);
        expect(result.errors).toBe(0);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toMatchObject({
            code: "12345",
            documentNumber: "12345",
            password: "ClaveFila123!",
        });
    });

    test("fila sin identidad (sin code ni documentNumber) cuenta como error", async () => {
        const csv = [
            "name,email",
            "Ana García,ana@mail.com",
        ].join("\n");
        const result = await parseFileContent("estudiantes.csv", csv);
        expect(result.rows).toHaveLength(0);
        expect(result.errors).toBe(1);
    });
});

// Un archivo sin filas importables no es una importación "con errores":
// el modal se queda en la selección con un aviso (rows vacío) y el paso
// final solo dice "con errores" si de verdad hubo filas fallidas.
describe("ImportStudentsModal — CSV vacío o sin filas válidas", () => {
    test("CSV vacío: sin filas y sin errores", async () => {
        expect(await parseFileContent("vacio.csv", "")).toEqual({ rows: [], errors: 0 });
    });

    test("CSV solo con encabezados: sin filas y sin errores", async () => {
        expect(await parseFileContent("encabezados.csv", HEADERS.join(","))).toEqual({ rows: [], errors: 0 });
    });

    test(".xlsx solo con encabezados: sin filas", async () => {
        const result = await parseFileContent("encabezados.xlsx", await xlsxOf([HEADERS]));
        expect(result.rows).toHaveLength(0);
    });

    test("archivo sin filas válidas: cero filas, errores contados", async () => {
        const csv = [HEADERS.join(","), ",,,,", "Sin correo,EST-1,,ADSI,3"].join("\n");
        const result = await parseFileContent("invalidas.csv", csv);
        expect(result.rows).toHaveLength(0);
        expect(result.errors).toBe(2);
    });
});

describe("importOutcome — mensaje final según el resultado real", () => {
    test("nada creado y nada fallido no es 'con errores'", () => {
        expect(importOutcome({ success: 0, errors: [] })).toBe("nothing");
    });
    test("todo creado", () => {
        expect(importOutcome({ success: 3, errors: [] })).toBe("ok");
    });
    test("creados y fallidos", () => {
        expect(importOutcome({ success: 2, errors: [{ student: "x", reason: "y" }] })).toBe("partial");
    });
    test("solo fallidos o sin respuesta", () => {
        expect(importOutcome({ success: 0, errors: [{ student: "x", reason: "y" }] })).toBe("failed");
        expect(importOutcome(undefined)).toBe("failed");
    });
});

describe("targetCourseItems — el curso destino se puede deseleccionar", () => {
    test("la primera opción vacía permite volver a 'sin curso destino'", () => {
        const courses = [{ value: "MAT", label: "Matemáticas" }, { value: "ADSI", label: "ADSI" }];
        const items = targetCourseItems(courses, "Sin curso destino");
        expect(items[0]).toMatchObject({ value: "", label: "Sin curso destino" });
        expect(items.slice(1)).toEqual(courses);
    });
});
