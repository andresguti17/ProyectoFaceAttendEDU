// ============================================================
//  FaceAttend EDU — backendRoles
//
//  ÚNICO mapa rol del backend → rol de la UI.
//  Compartido por AuthContext (sesión) y UserStorage (listado),
//  en espejo de Mobile/src/utils/getHighestRole.js.
// ============================================================

// Catálogo vigente (database/02-ms-authorization-db/02-dml/
// 004-unify-mobile-roles + 007-split-super-admin-role):
// Super Administrador | Administrador | Instructor | Aprendiz.
// Se aceptan también los nombres legados (001-seed-role-table)
// por si la base todavía no fue migrada.
// Normaliza un nombre de rol del backend a la llave de los mapas: mayúsculas
// y espacios (cualquier racha) unificados como guion bajo. El catálogo guarda
// "Super Administrador" (con espacio, 007-split-super-admin-role); sin esto la
// llave resultante "SUPER ADMINISTRADOR" no coincidiría con
// SUPER_ADMINISTRADOR y la cuenta se rechazaría como rol no reconocido.
const normalizeRoleKey = (name) =>
    String(name ?? "").trim().replace(/\s+/g, "_").toUpperCase();

export const ROLE_BY_BACKEND_ROLE = {
    // Vigentes
    SUPER_ADMINISTRADOR: "admin",
    ADMINISTRADOR: "admin",
    INSTRUCTOR: "teacher",
    APRENDIZ: "student",
    // Legados / sin migrar
    SUPER_ADMIN: "admin",
    SCHOOL_ADMIN: "admin",
    ADMIN: "admin",
    RECTOR: "admin",
    COORDINATOR: "admin",
    DOCENTE: "teacher",
    TEACHER: "teacher",
    STUDENT: "student",
    ESTUDIANTE: "student",
};

// Roles que identifican al administrador global: el rol explícito vigente
// (007-split-super-admin-role) y su nombre legado pre-unificación.
const SUPER_ADMIN_ROLE_NAMES = new Set(["SUPER_ADMINISTRADOR", "SUPER_ADMIN"]);

/**
 * @param {string[]} roleNames nombres de rol tal como vienen del backend
 * @returns {boolean} true si la cuenta es administrador global por rol explícito
 */
export function hasSuperAdminRole(roleNames) {
    return (roleNames ?? []).some((name) =>
        SUPER_ADMIN_ROLE_NAMES.has(normalizeRoleKey(name))
    );
}

// Prioridad de resolución: admin > teacher > student.
export const ROLE_PRIORITY = ["admin", "teacher", "student"];

/**
 * @param {string[]} roleNames nombres de rol tal como vienen del backend
 * @returns {"admin"|"teacher"|"student"|null}
 */
export function toUiRole(roleNames) {
    const mapped = (roleNames ?? [])
        .map((name) => ROLE_BY_BACKEND_ROLE[normalizeRoleKey(name)])
        .filter(Boolean);
    return ROLE_PRIORITY.find((role) => mapped.includes(role)) ?? null;
}

/**
 * Extrae los nombres de rol de una respuesta de GET /users/{id}/roles
 * (arreglo plano o { data: [...] }).
 * @returns {string[]}
 */
export function roleNamesFrom(payload) {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
    return list.map((role) => role?.roleName ?? role?.role_name).filter(Boolean);
}

// ── Etiqueta visible del rol (sidebar, bajo el nombre) ───────
// El catálogo distingue dos roles de administración:
//   - "Super Administrador" (007) → Super Admin (global, sin sede propia)
//   - "Administrador" → Admin de sede
// Los nombres legados siguen mapeando directo por compatibilidad; si la
// respuesta no trae roles reconocidos, se deriva de la sede de la cuenta.
const ROLE_DISPLAY_LABEL = {
    SUPER_ADMINISTRADOR: "Super Admin",
    SUPER_ADMIN: "Super Admin",
    ADMINISTRADOR: "Admin de sede",
    SCHOOL_ADMIN: "Admin de sede",
    RECTOR: "Rector",
    COORDINATOR: "Coordinador",
    INSTRUCTOR: "Docente",
    DOCENTE: "Docente",
    TEACHER: "Docente",
    APRENDIZ: "Estudiante",
    STUDENT: "Estudiante",
    ESTUDIANTE: "Estudiante",
};

/**
 * Etiqueta a mostrar bajo el nombre del usuario en la UI.
 * Prioriza los nombres de rol del backend (user.roles) y, si ninguno se
 * reconoce, cae al rol de la UI (user.role) — para admin, derivando
 * Super Admin vs Admin de sede según la sede de la cuenta.
 * @param {{ roles?: string[], role?: string, schoolId?: number|null }} user
 * @returns {string}
 */
export function roleDisplayLabel(user) {
    // El rol explícito de administrador global gana sobre cualquier otro rol.
    if (hasSuperAdminRole(user?.roles)) return "Super Admin";
    const fromBackend = (user?.roles ?? [])
        .map((name) => ROLE_DISPLAY_LABEL[normalizeRoleKey(name)])
        .find(Boolean);
    if (fromBackend) return fromBackend;
    const ui = user?.role;
    // Fallback para cuentas sin roles reconocidos en la respuesta.
    if (ui === "admin") return user?.schoolId == null ? "Super Admin" : "Admin de sede";
    if (ui === "teacher") return "Docente";
    if (ui === "student") return "Estudiante";
    return ui ?? "";
}
