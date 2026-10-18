// Identity (ms-identity :8081, vía gateway Kong). Sesiones, personas,
// usuarios y recuperación de contraseña.
//
// Nota: los cuerpos van en snake_case, tal como los espera el backend
// (el Mobile los construye en los modelos con toApi()); aquí no se
// transforma nada, la capa solo transporta.
//
// El flujo de login completa roles con authorizationApi.userRoles().
import { request } from "../../api/apiClient";
import { endpoints } from "../../api/endpoints";

export const authApi = {
    // ── Sesión ──────────────────────────────────────────
    // Acepta { email, password } o { username, password }: el backend
    // resuelve el identificador por el valor ('@' → correo, si no → username).
    login: ({ email, username, password }) =>
        request(endpoints.identity.login, {
            method: "POST",
            body: { email: email ?? username, password },
        }),
    logout: (sessionId) =>
        request(endpoints.identity.logout, { method: "POST", query: { sessionId } }),
    me: (identifier) =>
        request(endpoints.identity.me, {
            method: "GET",
            query: String(identifier).includes("@")
                ? { email: identifier }
                : { username: identifier },
        }),

    /**
     * Sede del usuario, leida de su academic_actor. Devuelve null si la persona
     * no tiene actor (p. ej. el super admin global), y en ese caso la aplicacion
     * sigue mostrando todas las sedes.
     */
    schoolOf: async (personId) => {
        try {
            const actors = await request(endpoints.academic.actorsByPerson(personId), { method: "GET" });
            const list = Array.isArray(actors) ? actors : [];
            const active = list.find((a) => a?.status !== false) ?? list[0];
            return active?.schoolId != null
                ? { schoolId: active.schoolId, academicActorId: active.academicActorId }
                : null;
        } catch {
            return null;
        }
    },

    // ── Roles y permisos del usuario autenticado ────────
    userRoles: (userId) =>
        request(endpoints.authorization.userRoles(userId), { method: "GET" }),
    evaluate: (userId, permission) =>
        request(endpoints.authorization.evaluate, {
            method: "GET",
            query: { userId, permission },
        }),

    // ── Personas ────────────────────────────────────────
    listPersons: (params) => request(endpoints.identity.persons, { method: "GET", query: params }),
    getPerson: (id) => request(endpoints.identity.personById(id), { method: "GET" }),
    createPerson: (b) => request(endpoints.identity.persons, { method: "POST", body: b }),
    updatePerson: (id, b) => request(endpoints.identity.personById(id), { method: "PUT", body: b }),
    deletePerson: (id) => request(endpoints.identity.personById(id), { method: "DELETE" }),
    setPersonStatus: (id, status) =>
        request(endpoints.identity.personStatus(id), { method: "PATCH", query: { status } }),

    // ── Usuarios ────────────────────────────────────────
    listUsers: (params) => request(endpoints.identity.users, { method: "GET", query: params }),
    getUser: (id) => request(endpoints.identity.userById(id), { method: "GET" }),
    getUserByUsername: (username) =>
        request(endpoints.identity.users, { method: "GET", query: { username } }),
    createUser: (b) => request(endpoints.identity.users, { method: "POST", body: b }),
    updateUser: (id, b) => request(endpoints.identity.userById(id), { method: "PUT", body: b }),
    deleteUser: (id) => request(endpoints.identity.userById(id), { method: "DELETE" }),
    setUserStatus: (id, status) =>
        request(endpoints.identity.userStatus(id), { method: "PATCH", query: { status } }),

    // ── Sesiones de usuario ─────────────────────────────
    listSessions: (params) => request(endpoints.identity.sessions, { method: "GET", query: params }),
    getSession: (id) => request(endpoints.identity.sessionById(id), { method: "GET" }),
    listSessionsByUser: (userId) =>
        request(endpoints.identity.sessionsByUser(userId), { method: "GET" }),

    // ── Recuperación de contraseña ──────────────────────
    // Paridad con Mobile: Kong enruta /api/v1/auth, pero el backend
    // todavía no implementa estos tres (responden 404).
    forgotPassword: (email) =>
        request(endpoints.identity.forgotPassword, {
            method: "POST",
            body: { email: String(email).toLowerCase().trim() },
        }),
    verifyCode: (email, code) =>
        request(endpoints.identity.verifyCode, {
            method: "POST",
            body: { email: String(email).toLowerCase().trim(), code },
        }),
    resetPassword: (email, password) =>
        request(endpoints.identity.resetPassword, {
            method: "POST",
            body: { email: String(email).toLowerCase().trim(), password },
        }),

    // ── Catálogos y política de contraseñas ─────────────
    getPasswordPolicies: () =>
        request(endpoints.identity.passwordPolicies, { method: "GET" }),
};
