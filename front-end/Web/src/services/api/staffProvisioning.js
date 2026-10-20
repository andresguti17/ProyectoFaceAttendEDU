// ============================================================
//  FaceAttend EDU — Staff provisioning (teacher/admin registration)
//
//  Cadena de alta verificada contra el backend:
//  1. POST /api/v1/persons          (PersonDto, camelCase)
//  2. POST /api/v1/users            (CreateUserRequest: personId, username, password)
//  3. POST /api/v1/users/{id}/roles ({roleId}, resuelto por nombre)
//  4. Solo docentes: POST /api/v1/academic-actors (actorTypeId 2 = INSTRUCTOR)
//     Solo admins:    POST /api/v1/academic-actors (actorTypeId 3 = ADMIN,
//                     vínculo admin→sede para acotar su sesión)
//
//  Los admins no llevan academic_actor: la identidad es agnóstica de
//  sede (AGENTS.md §2.6) y el actor solo existe para STUDENT/INSTRUCTOR.
// ============================================================

import { authApi } from "./authApi";
import { generateTemporaryPassword } from "../../core/utils/passwordGenerator";
import { academicApi } from "./academicApi";
import { authorizationApi } from "./authorizationApi";
import { listBlocks, listCohorts, listCourses, listPrograms, personMap, resetReferenceData } from "./referenceData";

// Nombres de rol aceptados (ES actuales + legados EN): los IDs
// autoincrementales dependen del seed, nunca se hardcodean.
// "Super Administrador" queda FUERA a propósito: el alta por UI nunca
// otorga el rol global (solo se asigna desde la matriz existente o por
// cambio de rol de un super, HU-IAM-010).
const ROLE_ALIASES = {
    admin: new Set(["administrador", "school admin"]),
    teacher: new Set(["instructor"]),
    student: new Set(["aprendiz", "student"]),
};

function normalizeRoleName(name) {
    return String(name ?? "")
        .trim()
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\s+/g, " ");
}

function resolveRoleId(roles, kind) {
    const list = Array.isArray(roles) ? roles : roles?.content ?? [];
    const aliases = ROLE_ALIASES[kind] ?? new Set();
    const found = list.find((r) =>
        aliases.has(normalizeRoleName(r?.roleName ?? r?.role_name))
    );
    return found?.roleId ?? found?.role_id ?? null;
}

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

/**
 * Campos opcionales de persona (PersonDto): solo los valores válidos
 * y no vacíos se incluyen en el cuerpo.
 */
export function personDetails(details = {}) {
    const out = {};
    const documentType = String(details.documentType ?? "").trim().toUpperCase();
    if (DOCUMENT_TYPES.includes(documentType)) out.documentType = documentType;
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
 * Crea persona + actor + usuario + rol (en ese orden para poder
 * compensar: el actor se crea antes que el usuario porque el usuario
 * no tiene endpoint de borrado).
 * Si algo falla tras crear la persona, se intenta borrar el actor y
 * la persona para no dejar huérfanos en identity/academic.
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
}) {
    const { name: firstName, lastName } = splitName(name);
    await assertPersonUnique({ documentNumber, email });
    const person = await authApi.createPerson({
        documentNumber: String(documentNumber).trim(),
        name: firstName,
        lastName,
        email: String(email).trim().toLowerCase(),
        status: true,
        ...personDetails(details),
    });
    const personId = person?.personId ?? person?.person_id ?? null;
    if (!personId) throw new Error("Person creation returned no id");

    let actorId = null;
    try {
        if (role === "teacher" || role === "admin") {
            // INSTRUCTOR en docentes, ADMIN vinculado a sede en admins:
            // la sesión queda acotada a la sede elegida en vez de global.
            const targetSchoolId = await resolveSchoolId(schoolId);
            const actor = await academicApi.createActor({
                personId,
                actorTypeId: role === "teacher" ? 2 : 3,
                schoolId: targetSchoolId,
                actorCode: String(code).trim(),
                startedOn: new Date().toISOString().slice(0, 10),
                status: true,
            });
            actorId = actor?.academicActorId ?? actor?.academic_actor_id ?? null;
        }

        const requestedUsername = usernameFromEmail(email);
        const user = await authApi.createUser({
            personId,
            username: requestedUsername,
            password,
            authenticationType: "Local",
            sendCredentials,
        });
        const userId = user?.userId ?? user?.user_id ?? null;
        if (!userId) throw new Error("User creation returned no id");

        const roles = await authorizationApi.listRoles();
        const roleId = resolveRoleId(roles, role);
        if (roleId != null) {
            await authorizationApi.assignRole(userId, roleId);
        }

        // listActors()/personMap()/userByPersonMap() de referenceData.js se
        // memorizan por sesión: sin esto, loadUsers() seguiría devolviendo
        // la lista de antes de crear esta persona.
        resetReferenceData();

        // El username real es el que confirma el backend, no el campo "código"
        // del formulario (que nunca se envía como username): el espejo local
        // debe usar este valor o la fila queda duplicada frente a la que
        // trae el siguiente loadUsers().
        return {
            personId,
            userId,
            username: user?.username ?? requestedUsername,
            credentialsEmail: user?.credentialsEmail ?? null,
        };
    } catch (err) {
        try {
            if (actorId != null) await academicApi.deleteActor(actorId);
        } catch {
            // La compensación es best-effort: se propaga el error original.
        }
        try {
            await authApi.deletePerson(personId);
        } catch {
            // La compensación es best-effort: se propaga el error original.
        }
        throw err;
    }
}

/**
 * Resultado de un alta con envío de credenciales: la UI lo distingue de un
 * error (cadena) porque es un objeto. null cuando no se pidió el correo.
 */
export function credentialsNotice(form, provisioned) {
    if (form?.sendCredentials === false) return null;
    return { credentialsEmail: provisioned?.credentialsEmail ?? "FAILED" };
}

function enrollmentIdOf(response) {
    return response?.enrollmentId ?? response?.enrollment_id ?? response?.id ?? null;
}

/**
 * Crea estudiante completo: persona + actor STUDENT + matrícula +
 * usuario + rol. Orden compensable (matrícula, actor y persona tienen
 * DELETE; el usuario no).
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
}) {
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
    const person = await authApi.createPerson({
        documentNumber: String(documentNumber).trim(),
        name: firstName,
        lastName,
        email: String(email).trim().toLowerCase(),
        status: true,
        ...personDetails(details),
    });
    const personId = person?.personId ?? person?.person_id ?? null;
    if (!personId) throw new Error("Person creation returned no id");

    let actorId = null;
    let enrollmentId = null;
    try {
        const actor = await academicApi.createActor({
            personId,
            actorTypeId: 1,
            schoolId: target.schoolId,
            actorCode: String(code).trim(),
            startedOn: new Date().toISOString().slice(0, 10),
            status: true,
        });
        actorId = actor?.academicActorId ?? actor?.academic_actor_id ?? null;
        if (actorId == null) throw new Error("Actor creation returned no id");

        const enrollment = await academicApi.createEnrollment({
            academicActorId: actorId,
            cohortId: target.cohortId,
            enrolledOn: new Date().toISOString().slice(0, 10),
            enrollmentStatus: "Active",
        });
        enrollmentId = enrollmentIdOf(enrollment);

        const user = await authApi.createUser({
            personId,
            username: usernameFromEmail(email),
            password,
            authenticationType: "Local",
            sendCredentials,
        });
        const userId = user?.userId ?? user?.user_id ?? null;
        if (!userId) throw new Error("User creation returned no id");

        const roles = await authorizationApi.listRoles();
        const roleId = resolveRoleId(roles, "student");
        if (roleId != null) {
            await authorizationApi.assignRole(userId, roleId);
        }

        // La importación masiva pasa resetCache=false: resetear la caché de
        // referencia en CADA fila recargaba persons/courses/cohorts por
        // estudiante y reventaba el rate-limit de Kong (60 req/min en
        // identity) a mitad de la tanda, dejando altas a medias.
        if (resetCache) resetReferenceData();
        return {
            personId,
            userId,
            actorId,
            cohortId: target.cohortId,
            credentialsEmail: user?.credentialsEmail ?? null,
        };
    } catch (err) {
        try {
            if (enrollmentId != null) await academicApi.deleteEnrollment(enrollmentId);
        } catch {}
        try {
            if (actorId != null) await academicApi.deleteActor(actorId);
        } catch {}
        try {
            await authApi.deletePerson(personId);
        } catch {}
        throw err;
    }
}

// Contraseña de respaldo para altas masivas SIN envío de credenciales: la
// plantilla CSV no trae una columna de contraseña (no tiene sentido pedirle a
// un admin que escriba contraseñas en texto plano en un archivo). Con envío
// de credenciales cada estudiante recibe en cambio una contraseña propia
// generada al azar, y debe cambiarla al ingresar.
const BULK_IMPORT_DEFAULT_PASSWORD = "Estudiante123!";

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
export async function importStudents(drafts, { sendCredentials = true } = {}) {
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
                password: String(
                    draft?.password ||
                        (sendCredentials ? generateTemporaryPassword() : BULK_IMPORT_DEFAULT_PASSWORD)
                ).trim(),
                sendCredentials,
                courseCode: course,
                // Par Curso+Ficha elegido en el modal (filas sin course o con
                // el mismo curso destino); null ⇒ provisión auto-resuelve.
                cohortId: draft?.cohortId ?? null,
                // La caché de referencia se surte UNA vez para toda la tanda.
                resetCache: false,
            });
            success += 1;
            if (sendCredentials) {
                if (provisioned?.credentialsEmail === "SENT") credentials.sent += 1;
                else credentials.notSent.push(label);
            }
        } catch (e) {
            errors.push({ student: label, reason: importErrorReason(e) });
        }
        // Pausa entre filas: cada estudiante cuesta 3 llamadas a identity y
        // el rate-limit del gateway es 60 req/min; sin este ritmo la tanda
        // reventaba el límite a mitad de importación (429) y dejaba alumnos
        // creados a medias (persona/actor sin usuario).
        if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 2600));
    }
    return { success, errors, credentials };
}
