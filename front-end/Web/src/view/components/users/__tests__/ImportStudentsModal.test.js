// ============================================================
//  Tests del parser de ImportStudentsModal (importStudentsParser)
//  Cubre los formatos que fallaban en "Importar estudiantes":
//  - CSV con "," (happy path)
//  - CSV con ";" + BOM UTF-8 (export de Excel en español)
//  - .xlsx binario (ExcelJS)
//  - Plantilla real sin course/grade y con documentNumber/password
// ============================================================

import { parseFileContent } from "../importStudentsParser";
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
