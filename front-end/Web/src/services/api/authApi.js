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
    // Segundo paso del login con 2FA: el código que llegó al correo abre la sesión.
    verifyLogin: ({ email, username, code }) =>
        request(endpoints.identity.loginVerify, {
            method: "POST",
            body: { identifier: email ?? username, code },
        }),
    // Segundo factor propio: activar (envía un código al correo), confirmar con
    // ese código y desactivar. Activar y desactivar piden la contraseña.
    enableTwoFactor: (password) =>
        request(endpoints.identity.twoFactorEnable, { method: "POST", body: { password } }),
    confirmTwoFactor: (code) =>
        request(endpoints.identity.twoFactorConfirm, { method: "POST", body: { code } }),
    disableTwoFactor: (password) =>
        request(endpoints.identity.twoFactorDisable, { method: "POST", body: { password } }),
    logout: (sessionId) =>
        // El id viaja como bearer, no en la URL: la URL queda en los logs de acceso.
        request(endpoints.identity.logout, { method: "POST", headers: { Authorization: `Bearer ${sessionId}` } }),
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

    // ── Cambio de contraseña de la propia cuenta ────────
    // Exige sesión y la contraseña actual; también apaga mustChangePassword.
    changePassword: (currentPassword, newPassword) =>
        request(endpoints.identity.changePassword, {
            method: "POST",
            body: { currentPassword, newPassword },
        }),

    // ── Perfil propio ───────────────────────────────────
    // Solo contacto y salud; el correo exige currentPassword. Devuelve la persona.
    updateMyProfile: (body) =>
        request(endpoints.identity.myProfile, { method: "PUT", body }),

    // ── Alta pública de sede + administrador ────────────
    // Sin sesión previa. Cuerpo { school, admin } en camelCase; la sede y el
    // administrador quedan pendientes de activación por un Super Administrador.
    onboardSchool: (body) =>
        request(endpoints.identity.onboardSchool, { method: "POST", body }),

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
    setPersonStatus: (id, status) =>
        request(endpoints.identity.personStatus(id), { method: "PATCH", query: { status } }),

    // ── Usuarios ────────────────────────────────────────
    listUsers: (params) => request(endpoints.identity.users, { method: "GET", query: params }),
    getUser: (id) => request(endpoints.identity.userById(id), { method: "GET" }),
    getUserByUsername: (username) =>
        request(endpoints.identity.users, { method: "GET", query: { username } }),
    createUser: (b) => request(endpoints.identity.users, { method: "POST", body: b }),
    // Alta compuesta en el servidor (persona + usuario + actor + matrícula + rol, con compensación).
    provisionUser: (b) => request(endpoints.identity.usersProvision, { method: "POST", body: b, timeoutMs: 60000 }),
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
