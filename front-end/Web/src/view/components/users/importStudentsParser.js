// ============================================================
//  FaceAttend EDU — importStudentsParser
//
//  Parseo puro (sin React ni React Native) de los archivos que
//  acepta "Importar estudiantes": la grilla cruda viene de
//  ../common/importFileParser (SheetJS para Excel, delimitador
//  detectado para texto) y aquí se traduce a drafts de alumno.
//
//  Módulo separado del modal para que los tests lo importen sin
//  arrastrar el árbol de componentes (barrel ../common).
//
//  Columnas esperadas (en cualquier orden, case-insensitive):
//    name | code | email | course | grade | documentNumber | password |
//    attendance | hasFacial | hasFingerprint | status
//
//  Las columnas mínimas requeridas son: name, code y email (code puede
//  completarse con documentNumber). course/grade NO se exigen aquí: si la
//  fila no trae curso, el modal aplica el "Curso destino" seleccionado
//  (provisionStudent necesita curso → cohorte → sede para matricular).
// ============================================================

import { parseImportFileGrid } from "../common/importFileParser";

const ALIAS = {
    // name
    name: "name",
    nombre: "name",
    "nombre completo": "name",
    // code
    code: "code",
    codigo: "code",
    "código": "code",
    id: "code",
    // email
    email: "email",
    correo: "email",
    "correo electrónico": "email",
    // course
    course: "course",
    programa: "course",
    carrera: "course",
    // grade
    grade: "grade",
    semestre: "grade",
    grado: "grade",
    // attendance
    attendance: "attendance",
    asistencia: "attendance",
    // hasFacial
    hasfacial: "hasFacial",
    facial: "hasFacial",
    rostro: "hasFacial",
    reconocimientofacial: "hasFacial",
    // hasFingerprint
    hasfingerprint: "hasFingerprint",
    huella: "hasFingerprint",
    huelladactilar: "hasFingerprint",
    dactilar: "hasFingerprint",
    fingerprint: "hasFingerprint",
    // status
    status: "status",
    estado: "status",
    // documentNumber
    documentnumber: "documentNumber",
    documento: "documentNumber",
    "numero de documento": "documentNumber",
    "número de documento": "documentNumber",
    cedula: "documentNumber",
    "cédula": "documentNumber",
    // password
    password: "password",
    clave: "password",
    contraseña: "password",
};

function normalizeHeader(h) {
    return ALIAS[h.trim().toLowerCase()] ?? null;
}

function rowToStudent(headers, cells) {
    const obj = {};
    headers.forEach((h, i) => {
        const key = normalizeHeader(h);
        if (!key) return;
        const val = (cells[i] ?? "").trim();
        if (key === "attendance") {
            obj.attendance = Math.min(100, Math.max(0, parseInt(val, 10) || 100));
        } else if (key === "hasFacial") {
            obj.hasFacial = val === "true" || val === "1" || val === "sí" || val === "si" || val === "yes";
        } else if (key === "hasFingerprint") {
            obj.hasFingerprint = val === "true" || val === "1" || val === "sí" || val === "si" || val === "yes";
        } else if (key === "status") {
            obj.status = val === "inactive" || val === "inactivo" ? "inactive" : "active";
        } else {
            obj[key] = val;
        }
    });
    // El código puede completarse con el documento (mismo criterio auto-gen
    // del formulario); sin ninguno de los dos no hay fila importable.
    const code = obj.code || obj.documentNumber || "";
    if (!obj.name || !code || !obj.email) return null;
    return {
        name: obj.name,
        code,
        email: obj.email,
        course: obj.course ?? "",
        grade: obj.grade ?? "",
        documentNumber: obj.documentNumber ?? "",
        password: obj.password ?? "",
        attendance: obj.attendance ?? 100,
        hasFacial: obj.hasFacial ?? false,
        hasFingerprint: obj.hasFingerprint ?? false,
        status: obj.status ?? "active",
    };
}

// Punto de entrada: binario de Excel jamás se lee como texto (se
// convertía en basura que el parser CSV descartaba sin filas válidas).
export function parseFileContent(name, buffer) {
    const { headers, rows } = parseImportFileGrid(name, buffer);
    let errors = 0;
    const parsed = [];
    rows.forEach((cells) => {
        const r = rowToStudent(headers, cells);
        if (r) parsed.push(r);
        else errors++;
    });
    return { rows: parsed, errors };
}
