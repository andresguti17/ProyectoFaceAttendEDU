// ============================================================
//  FaceAttend EDU — Staff provisioning (teacher/admin registration)
//
//  Una sola llamada: POST /api/v1/users/provision. identity crea persona y
//  usuario y pide a academic el actor (y la matrícula del aprendiz) y a
//  authorization el rol, con la sesión de quien llama. Si un paso falla, el
//  servidor deshace los anteriores: no quedan filas huérfanas ni hay
//  compensación en el navegador.
//  Tipos de actor: 1 = aprendiz, 2 = instructor, 3 = administrador de sede.
// ============================================================

import { authApi } from "./authApi";
import { generateTemporaryPassword } from "../../core/utils/passwordGenerator";
import { consentBody } from "./consentApi";
import { academicApi } from "./academicApi";
import { listBlocks, listCohorts, listCourses, listPrograms, personMap, resetReferenceData } from "./referenceData";

// Rol que pide la UI -> rol del catálogo y tipo de actor académico. "Super
// Administrador" queda FUERA a propósito: el alta por UI nunca otorga el rol
// global (el servidor también lo rechaza).
const ROLE_BY_KIND = {
    admin: { roleName: "Administrador", actorTypeId: 3 },
    teacher: { roleName: "Instructor", actorTypeId: 2 },
    student: { roleName: "Aprendiz", actorTypeId: 1 },
};

function splitName(fullName) {
    const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
    return {
        name: parts[0] ?? "",
        lastName: parts.slice(1).join(" ") || parts[0] || "",
    };
}

function usernameFromEmail(email) {
    const prefix = String(email ?? "").split("@")[0] ?? "";
    return prefix.toLowerCase().trim();
}

// Dominios cerrados del modelo (AGENTS.md §2.5): solo estos valores
// viajan al backend; cualquier otro se omite para no violar los CHECK.
export const DOCUMENT_TYPES = ["CC", "TI", "CE", "PP"];
export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// La tarjeta de identidad (TI) es de menores de edad: solo la usa un aprendiz.
// identity aplica la misma regla en POST /users/provision.
export const STAFF_DOCUMENT_TYPES = ["CC", "CE", "PP"];

/** Tipos de documento que admite un rol ("admin" | "teacher" | "student"). */
export function documentTypesForRole(role) {
    return role === "admin" || role === "teacher" ? STAFF_DOCUMENT_TYPES : DOCUMENT_TYPES;
}

/**
 * Campos opcionales de persona (PersonDto): solo los valores válidos
 * y no vacíos se incluyen en el cuerpo. Con `role`, el tipo de documento
 * se limita a los que admite ese rol.
 */
export function personDetails(details = {}, role = null) {
    const out = {};
    const documentType = String(details.documentType ?? "").trim().toUpperCase();
    if (documentTypesForRole(role).includes(documentType)) out.documentType = documentType;
    const bloodType = String(details.bloodType ?? "").trim().toUpperCase();
    if (BLOOD_TYPES.includes(bloodType)) out.bloodType = bloodType;
    const birthDate = String(details.birthDate ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) out.birthDate = birthDate;
    const address = String(details.address ?? "").trim();
    if (address) out.address = address;
    const phone = String(details.phone ?? "").trim();
    if (phone) out.phone = phone;
    return out;
}

/**
 * El 409 del backend no dice qué campo duplica ("Resource violates a
 * uniqueness constraint"): se verifica antes contra el padrón cargado
 * para devolver un mensaje específico por campo.
 * @throws Error con el campo duplicado.
 */
export async function assertPersonUnique({ documentNumber, email }) {
    let persons;
    try {
        persons = await personMap();
    } catch {
        return; // Sin padrón no se puede verificar: lo valida el backend.
    }
    if (!persons || typeof persons.values !== "function") return;
    const doc = String(documentNumber ?? "").trim();
    const mail = String(email ?? "").trim().toLowerCase();
    for (const person of persons.values()) {
        const personDoc = String(person?.documentNumber ?? person?.document_number ?? "").trim();
        const personMail = String(person?.email ?? "").trim().toLowerCase();
        if (doc && personDoc === doc) {
            throw new Error("Ya existe una persona con ese número de documento");
        }
        if (mail && personMail && personMail === mail) {
            throw new Error("Ya existe una persona con ese correo electrónico");
        }
    }
}

/**
 * Marca las filas cuyo correo o documento ya existe en el padrón de
 * personas: re-importar un archivo ya importado no debe verse como un
 * fallo fila por fila ("ya existe una persona con ese número de
 * documento"), sino como un simple "ya está en el sistema" que se omite.
 * El documento efectivo es documentNumber || code (mismo criterio con
 * que provisionStudent crea la persona).
 */
export function markExistingStudents(rows, persons) {
    const emails = new Set();
    const docs = new Set();
    for (const person of persons ?? []) {
        const mail = String(person?.email ?? "").trim().toLowerCase();
        const doc = String(person?.documentNumber ?? person?.document_number ?? "").trim();
        if (mail) emails.add(mail);
        if (doc) docs.add(doc);
    }
    return (rows ?? []).map((row) => {
        const mail = String(row?.email ?? "").trim().toLowerCase();
        const doc = String(row?.documentNumber || row?.code || "").trim();
        const existing = Boolean((mail && emails.has(mail)) || (doc && docs.has(doc)));
        return existing ? { ...row, existing: true } : row;
    });
}

/**
 * Versión contra el backend (personMap memoizado, sin llamada extra si
 * el padrón ya está cargado). Si el padrón no está disponible no se
 * marca nada: el backend sigue siendo la autoridad en unicidad.
 */
export async function findExistingStudents(rows) {
    let persons;
    try {
        persons = await personMap();
    } catch {
        return rows ?? [];
    }
    if (!persons || typeof persons.values !== "function") return rows ?? [];
    return markExistingStudents(rows, persons.values());
}

/**
 * Fichas vigentes que imparten un curso (por código), con su sede.
 * Vacío si el curso no existe en el backend.
 */
export async function cohortsForCourseCode(courseCode) {
    const courses = await listCourses();
    const course = (Array.isArray(courses) ? courses : []).find((c) => c?.code === courseCode);
    const courseId = course?.courseId ?? course?.course_id ?? null;
    if (courseId == null) return [];
    const [blocks, cohorts, programs] = await Promise.all([
        listBlocks().catch(() => []),
        listCohorts().catch(() => []),
        listPrograms().catch(() => []),
    ]);
    const cohortIds = new Set(
        (Array.isArray(blocks) ? blocks : [])
            .filter((b) => (b?.courseId ?? b?.course_id) === courseId)
            .map((b) => b?.cohortId ?? b?.cohort_id)
            .filter((id) => id != null)
    );
    const programById = new Map(
        (Array.isArray(programs) ? programs : []).map((p) => [
            p?.programId ?? p?.program_id,
            p,
        ])
    );
    const courseProgramId = course?.programId ?? course?.program_id ?? null;
    return (Array.isArray(cohorts) ? cohorts : [])
        .filter((c) => {
            const id = c?.cohortId ?? c?.cohort_id ?? null;
            const programId = c?.programId ?? c?.program_id ?? null;
            // Una ficha del mismo programa del curso es elegible aunque aún no
            // tenga horarios vinculados a ese curso.
            const belongs = cohortIds.has(id) || (courseProgramId != null && programId === courseProgramId);
            return id != null && belongs && c?.status !== false;
        })
        .map((c) => {
            const cohortId = c?.cohortId ?? c?.cohort_id ?? null;
            const programId = c?.programId ?? c?.program_id ?? null;
            const program = programId != null ? programById.get(programId) : null;
            return {
                cohortId,
                code: c?.code ?? "",
                schoolId: program?.schoolId ?? program?.school_id ?? null,
            };
        })
        .filter((c) => c.cohortId != null);
}

async function resolveSchoolId(explicit) {
    const parsed = explicit != null && String(explicit).trim() !== "" ? Number(explicit) : null;
    if (parsed != null && Number.isInteger(parsed)) return parsed;
    if (explicit != null && String(explicit).trim() !== "") {
        throw new Error("Invalid school");
    }
    const schools = await academicApi.listSchools();
    const list = Array.isArray(schools) ? schools : schools?.content ?? [];
    if (list.length !== 1) throw new Error("No school available for the staff record");
    const id = list[0]?.schoolId ?? list[0]?.school_id ?? null;
    if (id == null) throw new Error("No school available for the staff record");
    return id;
}

/**
 * Alta de docente o administrador de sede en una sola llamada al servidor.
 * El servidor deshace todo si un paso falla (persona, usuario, actor, rol).
 */
export async function provisionStaff({
    name,
    code,
    email,
    documentNumber,
    password,
    role,
    schoolId = null,
    details = {},
    sendCredentials = false,
    consent = null,
}) {
    // Ley 1581: sin la aceptación del aviso de privacidad no se crea la cuenta.
    if (!consent?.privacyAccepted) throw new Error("Confirma que la persona aceptó el aviso de privacidad");
    const target = ROLE_BY_KIND[role];
    if (!target || role === "student") throw new Error("Unsupported staff role");
    const { name: firstName, lastName } = splitName(name);
    await assertPersonUnique({ documentNumber, email });
    const targetSchoolId = await resolveSchoolId(schoolId);
    const requestedUsername = usernameFromEmail(email);
    const result = await authApi.provisionUser({
        person: {
            documentNumber: String(documentNumber).trim(),
            name: firstName,
            lastName,
            email: String(email).trim().toLowerCase(),
            status: true,
            ...personDetails(details, role),
        },
        username: requestedUsername,
        password,
        sendCredentials,
        roleName: target.roleName,
        academicActor: { actorTypeId: target.actorTypeId, schoolId: targetSchoolId, actorCode: String(code).trim() },
        consent: consentBody({ biometricAccepted: consent.biometricAccepted }),
    });

    // listActors()/personMap()/userByPersonMap() de referenceData.js se
    // memorizan por sesión: sin esto, loadUsers() seguiría devolviendo
    // la lista de antes de crear esta persona.
    resetReferenceData();
    return {
        personId: result?.personId ?? null,
        userId: result?.userId ?? null,
        username: result?.username ?? requestedUsername,
        credentialsEmail: result?.credentialsEmail ?? null,
    };
}

/**
 * Resultado de un alta con envío de credenciales: la UI lo distingue de un
 * error (cadena) porque es un objeto. null cuando no se pidió el correo.
 */
export function credentialsNotice(form, provisioned) {
    if (form?.sendCredentials === false) return null;
    return { credentialsEmail: provisioned?.credentialsEmail ?? "FAILED" };
}

/**
 * Alta de estudiante completo (persona + actor + matrícula + usuario + rol) en
 * una sola llamada; el servidor deshace todo si un paso falla.
 * @throws si el curso no tiene fichas vigentes o falta la ficha.
 */
export async function provisionStudent({
    name,
    code,
    email,
    documentNumber,
    password,
    courseCode,
    cohortId = null,
    details = {},
    resetCache = true,
    sendCredentials = false,
    consent = null,
}) {
    if (!consent?.privacyAccepted) throw new Error("Confirma que la persona aceptó el aviso de privacidad");
    const cohorts = await cohortsForCourseCode(courseCode);
    if (cohorts.length === 0) {
        throw new Error("The course has no active cohorts in the backend");
    }
    let target = cohorts.find((c) => String(c.cohortId) === String(cohortId ?? ""));
    if (cohortId != null && String(cohortId).trim() !== "" && !target) {
        throw new Error("The selected cohort is not valid for the course");
    }
    if (!target) {
        if (cohorts.length > 1) throw new Error("Select the student cohort");
        target = cohorts[0];
    }
    if (target.schoolId == null) throw new Error("The cohort program has no school");

    const { name: firstName, lastName } = splitName(name);
    await assertPersonUnique({ documentNumber, email });
    const result = await authApi.provisionUser({
        person: {
            documentNumber: String(documentNumber).trim(),
            name: firstName,
            lastName,
            email: String(email).trim().toLowerCase(),
            status: true,
            ...personDetails(details),
        },
        username: usernameFromEmail(email),
        password,
        sendCredentials,
        roleName: ROLE_BY_KIND.student.roleName,
        academicActor: {
            actorTypeId: ROLE_BY_KIND.student.actorTypeId,
            schoolId: target.schoolId,
            actorCode: String(code).trim(),
            cohortId: target.cohortId,
        },
        consent: consentBody({ biometricAccepted: consent.biometricAccepted }),
    });

    // La importación masiva pasa resetCache=false: resetear la caché de
    // referencia en CADA fila recargaba persons/courses/cohorts por
    // estudiante y reventaba el rate-limit de Kong a mitad de la tanda.
    if (resetCache) resetReferenceData();
    return {
        personId: result?.personId ?? null,
        userId: result?.userId ?? null,
        actorId: result?.academicActorId ?? null,
        cohortId: target.cohortId,
        credentialsEmail: result?.credentialsEmail ?? null,
    };
}

// Errores conocidos de provisionStudent traducidos al usuario.
function importErrorReason(e) {
    const msg = e?.message || "";
    if (msg === "Select the student cohort") {
        return "El curso tiene varias fichas activas: usa el Curso y la Ficha destino";
    }
    if (msg === "The course has no active cohorts in the backend") {
        return "El curso no tiene fichas activas en el backend";
    }
    if (msg === "The selected cohort is not valid for the course") {
        return "La ficha seleccionada no pertenece a ese curso";
    }
    if (e?.status === 429 || /429|Too Many/i.test(msg)) {
        return "El gateway limitó las peticiones (429): espera un minuto y reintenta la fila";
    }
    return msg || "El backend rechazó el estudiante";
}

/**
 * Importación masiva de estudiantes: un provisionStudent() por fila, sin
 * detenerse ante fallos individuales (igual que importCourses en
 * courseCreation.js). documentNumber/password pueden venir del archivo; si
 * la fila los trae vacíos se usan code y una contraseña por defecto.
 * Con `sendCredentials` (por defecto) cada fila recibe una contraseña
 * temporal propia y se le envía por correo; `credentials.notSent` lista a quienes
 * el correo no llegó (deberán usar "Olvidé mi contraseña" o recibirla del admin).
 * @returns {{ success: number, errors: Array<{ student: string, reason: string }>,
 *   credentials: { sent: number, notSent: string[] } }}
 */
export async function importStudents(drafts, { sendCredentials = true, privacyAccepted = false } = {}) {
    // Ley 1581: quien importa confirma que cada titular aceptó el aviso de privacidad.
    // La parte biométrica queda pendiente: cada persona la decide al registrar su rostro.
    if (!privacyAccepted) throw new Error("Confirma que cada persona aceptó el aviso de privacidad");
    let success = 0;
    const errors = [];
    const credentials = { sent: 0, notSent: [] };
    const rows = drafts ?? [];
    for (let i = 0; i < rows.length; i += 1) {
        const draft = rows[i];
        const name = String(draft?.name ?? "").trim();
        const code = String(draft?.code ?? "").trim();
        const email = String(draft?.email ?? "").trim();
        const course = String(draft?.course ?? "").trim();
        const label = name || code || email || "Estudiante desconocido";
        if (!name || !code || !email || !course) {
            errors.push({ student: label, reason: "Nombre, código, correo y curso son requeridos" });
            continue;
        }
        try {
            const provisioned = await provisionStudent({
                name,
                code,
                email,
                // "||" y no "??": el parser puede traer cadenas vacías, y una
                // persona sin documento no existe en el modelo (NOT NULL).
                documentNumber: String(draft?.documentNumber || code).trim(),
                // La plantilla CSV no trae contraseña: cada estudiante recibe una
                // aleatoria y propia (nunca una fija y conocida). Sin envío de
                // credenciales la cuenta se activa con "Olvidé mi contraseña".
                password: String(draft?.password || generateTemporaryPassword()).trim(),
                sendCredentials,
                courseCode: course,
                // Par Curso+Ficha elegido en el modal (filas sin course o con
                // el mismo curso destino); null ⇒ provisión auto-resuelve.
                cohortId: draft?.cohortId ?? null,
                // La caché de referencia se surte UNA vez para toda la tanda.
                resetCache: false,
                consent: { privacyAccepted: true, biometricAccepted: false },
            });
            success += 1;
            if (sendCredentials) {
                if (provisioned?.credentialsEmail === "SENT") credentials.sent += 1;
                else credentials.notSent.push(label);
            }
        } catch (e) {
            errors.push({ student: label, reason: importErrorReason(e) });
        }
        // Pausa entre filas para no saturar el rate-limit del gateway. Ya no
        // quedan altas a medias: el servidor deshace una fila que falla.
        if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 2600));
    }
    // Las filas no invalidaron la caché (resetCache=false): se hace una vez al
    // final para que reloadStudents() traiga a los recién creados y no la lista
    // memorizada de antes de importar.
    if (success > 0) resetReferenceData();
    return { success, errors, credentials };
}
