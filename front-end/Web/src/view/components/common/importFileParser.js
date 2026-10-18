// ============================================================
//  FaceAttend EDU — importFileParser
//
//  Parseo de bajo nivel (sin React) compartido por los modales
//  de importación (estudiantes y cursos): convierte el binario o
//  texto de un archivo en una grilla { headers, rows } de strings.
//
//  - .xlsx/.xls/.xlsm: binario, se lee con SheetJS (dependencies).
//  - .csv/.tsv/.txt: texto, con detección de delimitador
//    (, ; tab) y tolerancia a BOM UTF-8 y comillas.
//
//  Cada modal traduce la grilla a sus propios drafts con su ALIAS
//  de columnas; aquí no hay semántica de negocio.
// ============================================================

// Detecta el delimitador mirando la línea de encabezados:
// el Excel en español exporta ";" y TSV usa tab.
function detectDelimiter(headerLine) {
    const candidates = [",", ";", "\t"];
    let best = ",";
    let bestCount = -1;
    for (const d of candidates) {
        const count = headerLine.split(d).length - 1;
        if (count > bestCount) {
            best = d;
            bestCount = count;
        }
    }
    return best;
}

// Split de una línea respetando comillas ("campo, con coma").
function splitDelimitedLine(line, delim) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === delim) {
            out.push(cur.trim());
            cur = "";
        } else {
            cur += ch;
        }
    }
    out.push(cur.trim());
    return out;
}

export function parseDelimitedText(text) {
    // BOM UTF-8 de Excel rompería el primer header ("code" → "﻿code")
    const clean = text.replace(/^\uFEFF/, "").replace(/\r/g, "");
    // "#" inicia comentarios/notas (la plantilla trae una); no son filas.
    const lines = clean.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    if (lines.length < 2) return { headers: [], rows: [] };
    const delim = detectDelimiter(lines[0]);
    return {
        headers: splitDelimitedLine(lines[0], delim),
        rows: lines.slice(1).map((l) => splitDelimitedLine(l, delim)),
    };
}

export function parseExcelBuffer(buffer) {
    const XLSX = require("xlsx");
    const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const grid = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
    });
    if (grid.length < 2) return { headers: [], rows: [] };
    const headers = grid[0].map((h) => String(h ?? "").trim());
    const rows = grid
        .slice(1)
        .map((r) => (Array.isArray(r) ? r : []).map((c) => String(c ?? "").trim()))
        .filter((r) => r.some((c) => c));
    return { headers, rows };
}

// Punto de entrada común: el binario de Excel jamás se lee como
// texto (se convertiría en basura que el parser CSV descarta).
export function parseImportFileGrid(name, buffer) {
    const isExcel = /\.(xlsx|xls|xlsm)$/i.test(name || "");
    return isExcel
        ? parseExcelBuffer(buffer)
        : parseDelimitedText(typeof buffer === "string" ? buffer : new TextDecoder("utf-8").decode(buffer));
}
