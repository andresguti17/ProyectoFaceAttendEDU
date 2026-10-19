// ============================================================
//  Tests del parser de ImportCoursesModal (importCoursesParser)
//  Cubre los 3 formatos que fallaban en "Importar cursos":
//  - CSV con "," (happy path)
//  - CSV con ";" + BOM UTF-8 (export de Excel en español)
//  - .xlsx binario (SheetJS)
// ============================================================

import { parseFileContent } from "../importCoursesParser";
import * as XLSX from "xlsx";

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
    test("CSV con comas", () => {
        const csv = [
            HEADERS.join(","),
            "2240083,Bases de Datos I,ADSI",
        ].join("\n");
        expectOneRow(parseFileContent("cursos.csv", csv));
    });

    test("CSV con punto y coma y BOM UTF-8 (Excel español)", () => {
        const csv = "\uFEFF" + [
            HEADERS.join(";"),
            "2240083;Bases de Datos I;ADSI",
        ].join("\r\n");
        expectOneRow(parseFileContent("cursos.csv", csv));
    });

    test("columnas en cualquier orden y con alias en español", () => {
        const csv = [
            "programa,código,nombre",
            "ADSI,2240083,Bases de Datos I",
        ].join("\n");
        expectOneRow(parseFileContent("cursos.csv", csv));
    });

    test(".xlsx binario se parsea con SheetJS", () => {
        const ws = XLSX.utils.aoa_to_sheet([
            HEADERS,
            ["2240083", "Bases de Datos I", "ADSI"],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        expectOneRow(parseFileContent("cursos.xlsx", buf));
    });

    test("filas incompletas se contabilizan como error, no se descartan en silencio", () => {
        const csv = [
            HEADERS.join(","),
            "2240083,Bases de Datos I,ADSI",
            "2240084,,",
        ].join("\n");
        const result = parseFileContent("cursos.csv", csv);
        expect(result.rows).toHaveLength(1);
        expect(result.errors).toBe(1);
    });
});
