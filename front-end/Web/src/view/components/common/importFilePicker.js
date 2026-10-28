// ============================================================
//  FaceAttend EDU — importFilePicker
//
//  Lado del navegador de los modales de importación (estudiantes y
//  cursos): elegir el archivo y descargar la plantilla CSV. El
//  parseo vive en importFileParser. Solo web: en nativo no hacen nada.
// ============================================================

import { Platform } from "react-native";

/** Formats importFileParser can read (.xls, the old binary format, is not one). */
export const IMPORT_FILE_ACCEPT = ".csv,.xlsx,.xlsm,.tsv,.txt";

/** Lets the user pick one file; resolves { name, buffer } or null when cancelled. */
export function pickImportFile() {
    return new Promise((resolve) => {
        if (Platform.OS !== "web") {
            resolve(null);
            return;
        }
        const input = document.createElement("input");
        input.type = "file";
        input.accept = IMPORT_FILE_ACCEPT;
        input.onchange = (e) => {
            const file = e.target?.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => resolve({ name: file.name, buffer: evt.target?.result });
            reader.onerror = () => resolve(null);
            // ArrayBuffer for everything: .xlsx files are ZIP archives and reading them
            // as text produced garbage the CSV parser silently dropped.
            reader.readAsArrayBuffer(file);
        };
        input.click();
    });
}

/** Downloads `content` as a UTF-8 CSV named `filename`. */
export function downloadCsvTemplate(content, filename) {
    if (Platform.OS !== "web") return;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
