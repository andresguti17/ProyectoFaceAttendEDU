// ============================================================
//  Tests del parser de ImportCoursesModal (importCoursesParser)
//  Cubre los 3 formatos que fallaban en "Importar cursos":
//  - CSV con "," (happy path)
//  - CSV con ";" + BOM UTF-8 (export de Excel en español)
//  - .xlsx binario (ExcelJS)
// ============================================================

import { parseFileContent } from "../importCoursesParser";
import ExcelJS from "exceljs";

/** A real .xlsx file with `rows` on its first sheet. */
async function xlsxOf(rows) {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Hoja1").addRows(rows);
    return workbook.xlsx.writeBuffer();
}

const HEADERS = ["code", "name", "program"];

const expectOneRow = (result) => {
    expect(result.errors).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
        code: "2240083",
        name: "Bases de Datos I",
        program: "ADSI",
    });
};

describe("ImportCoursesModal — parseFileContent", () => {
    test("CSV con comas", async () => {
        const csv = [
            HEADERS.join(","),
            "2240083,Bases de Datos I,ADSI",
        ].join("\n");
        expectOneRow(await parseFileContent("cursos.csv", csv));
    });

    test("CSV con punto y coma y BOM UTF-8 (Excel español)", async () => {
        const csv = "\uFEFF" + [
            HEADERS.join(";"),
            "2240083;Bases de Datos I;ADSI",
        ].join("\r\n");
        expectOneRow(await parseFileContent("cursos.csv", csv));
    });

    test("columnas en cualquier orden y con alias en español", async () => {
        const csv = [
            "programa,código,nombre",
            "ADSI,2240083,Bases de Datos I",
        ].join("\n");
        expectOneRow(await parseFileContent("cursos.csv", csv));
    });

    test(".xlsx binario se parsea con ExcelJS", async () => {
        const buf = await xlsxOf([
            HEADERS,
            ["2240083", "Bases de Datos I", "ADSI"],
        ]);
        expectOneRow(await parseFileContent("cursos.xlsx", buf));
    });

    test("filas incompletas se contabilizan como error, no se descartan en silencio", async () => {
        const csv = [
            HEADERS.join(","),
            "2240083,Bases de Datos I,ADSI",
            "2240084,,",
        ].join("\n");
        const result = await parseFileContent("cursos.csv", csv);
        expect(result.rows).toHaveLength(1);
        expect(result.errors).toBe(1);
    });
});
