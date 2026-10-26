jest.mock("react-native", () => ({ Platform: { OS: "web" } }));
jest.mock("../../config/institutionConfig", () => ({ getInstitutionConfig: () => ({ dateFormat: "YYYY-MM-DD" }) }));

import ExcelJS from "exceljs";
import { exportToExcel } from "../exportHelpers";

describe("exportToExcel", () => {
    let saved;

    beforeEach(() => {
        saved = { link: null, blob: null };
        global.URL.createObjectURL = jest.fn((blob) => {
            saved.blob = blob;
            return "blob:report";
        });
        global.URL.revokeObjectURL = jest.fn();
        const create = document.createElement.bind(document);
        jest.spyOn(document, "createElement").mockImplementation((tag) => {
            const element = create(tag);
            if (tag === "a") {
                element.click = jest.fn();
                saved.link = element;
            }
            return element;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("downloads a real workbook: one sheet per entry, keys as headers, widths applied", async () => {
        const result = await exportToExcel(
            [{ name: "Estudiantes", data: [{ Código: "A1", Asistencia: 90 }, { Código: "A2", Asistencia: 75 }], columns: [{ wch: 12 }, { wch: 8 }] }],
            "reporte.xlsx",
        );

        expect(result).toEqual({ success: true });
        expect(saved.link.download).toBe("reporte.xlsx");
        expect(saved.link.click).toHaveBeenCalled();
        expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:report");

        const workbook = new ExcelJS.Workbook();
        // jsdom's Blob has no arrayBuffer(): FileReader reads it.
        const bytes = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsArrayBuffer(saved.blob);
        });
        await workbook.xlsx.load(bytes);
        const sheet = workbook.getWorksheet("Estudiantes");
        expect(sheet.getRow(1).values.slice(1)).toEqual(["Código", "Asistencia"]);
        expect(sheet.getRow(3).values.slice(1)).toEqual(["A2", 75]);
        expect(sheet.getColumn(1).width).toBe(12);
    });

    test("reports a failure instead of throwing", async () => {
        const result = await exportToExcel([{ name: "Hoja", data: null }], "bad.xlsx");
        expect(result.success).toBe(false);
        expect(saved.link).toBeNull();
    });
});
