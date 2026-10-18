// ============================================================
//  FaceAttend EDU — importCoursesParser
//
//  Parseo puro (sin React ni React Native) de los archivos que
//  acepta "Importar cursos": la grilla cruda viene de
//  ../../components/common/importFileParser (SheetJS para Excel,
//  delimitador detectado para texto) y aquí se traduce a drafts
//  de curso.
//
//  Módulo separado del modal para que los tests lo importen sin
//  arrastrar el árbol de componentes (barrel ../common).
//
//  Columnas esperadas (en cualquier orden, case-insensitive):
//    code | name | program (+ opcionales: schedule, room, instructor)
//
//  La columna mínima requerida es: code, name, program.
// ============================================================

import { parseImportFileGrid } from "../../../components/common/importFileParser";

const ALIAS = {
    code: "code",
    codigo: "code",
    "código": "code",
    id: "code",
    name: "name",
    nombre: "name",
    curso: "name",
    program: "program",
    programa: "program",
    carrera: "program",
    schedule: "schedule",
    horario: "schedule",
    jornada: "schedule",
    room: "room",
    salon: "room",
    "salón": "room",
    aula: "room",
    ambiente: "room",
    instructor: "instructor",
    docente: "instructor",
    profesor: "instructor",
};

function normalizeHeader(h) {
    return ALIAS[h.trim().toLowerCase()] ?? null;
}

function rowToCourse(headers, cells) {
    const obj = {};
    headers.forEach((h, i) => {
        const key = normalizeHeader(h);
        if (!key) return;
        obj[key] = (cells[i] ?? "").trim();
    });
    if (!obj.code || !obj.name || !obj.program) return null;
    return obj;
}

// Punto de entrada: binario de Excel jamás se lee como texto (se
// convertía en basura que el parser CSV descartaba sin filas válidas).
export function parseFileContent(name, buffer) {
    const { headers, rows } = parseImportFileGrid(name, buffer);
    let errors = 0;
    const parsed = [];
    rows.forEach((cells) => {
        const r = rowToCourse(headers, cells);
        if (r) parsed.push(r);
        else errors++;
    });
    return { rows: parsed, errors };
}
