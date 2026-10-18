// ============================================================
//  FaceAttend EDU — UserStorage
//
//  Lectura de usuarios: API de identidad (GET /users + /persons)
//  con los mocks como respaldo si falla.
//
//  Derivados que el backend aún no expone y se calculan aquí:
//  - name / email: desde identity.person (UserDto no los trae)
//  - role: GET /users/{id}/roles mapeado a admin|teacher|student
//    (sin endpoint por lote: se pide uno a uno, lista corta)
//  - code: username (no hay campo "code" en el backend)
//  - department: null (no expuesto por el backend)
//  - course: solo docentes, desde los bloques horarios
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_MODE } from "../../config/env";
import { mockAppUsers } from "./mockData";
import { roleNamesFrom, toUiRole } from "../../core/utils/backendRoles";
import {
    fullName,
    instructorCourseNamesByPerson,
    listActors,
    normalizeStatus,
    optional,
    personMap,
    rolesForUser,
    rolesForUsers,
    userByPersonMap,
} from "../../services/api/referenceData";

const STORAGE_KEY = "@faceattend_users";
const LOCAL_PREFIX = "usr_";

function generateId() {
    return `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Lectura ───────────────────────────────────────────────

async function localUsers() {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (user) => typeof user?.id === "string" && user.id.startsWith(LOCAL_PREFIX)
        );
    } catch {
        return [];
    }
}

/** Respaldo cuando GET /user-roles no existe: concurrencia 5 para no saturar el gateway. */
async function rolesOneByOne(users) {
    const fetchOne = (user) => optional(rolesForUser(user.userId).then(roleNamesFrom), []);
    const roles = [];
    const BATCH = 5;
    for (let i = 0; i < users.length; i += BATCH) {
        roles.push(...(await Promise.all(users.slice(i, i + BATCH).map(fetchOne))));
    }
    return roles;
}

async function usersFromApi() {
    // La lista se arma desde academic_actor, no desde /users: el actor es lo que
    // ata una persona a una sede (app_user no tiene sede, MODELO §2.6), así que
    // recorrerlo es lo que hace que la vista respete la institución del usuario.
    // listActors() ya viene acotado a la sede activa.
    //
    // Consecuencia: una cuenta sin academic_actor no aparece — no pertenece a
    // ninguna institución — y un actor sin cuenta tampoco, porque no hay usuario
    // que mostrar.
    const [actors, usersByPerson, persons] = await Promise.all([
        listActors(),
        userByPersonMap(),
        personMap(),
    ]);
    if (!Array.isArray(actors)) return [];

    const seen = new Set();
    const users = [];
    // Actor de la sede activa por persona: lo mismo que ata la cuenta a la sede
    // aporta el código real del actor (DOC-…) y su school_id, que la lista de
    // usuarios antes descartaba y que la edición necesita mostrar.
    const actorByPerson = new Map();
    for (const actor of actors) {
        const user = usersByPerson.get(actor.personId);
        // Una persona puede ser actor en varias sedes: su cuenta es una sola.
        if (!user || seen.has(user.userId)) continue;
        seen.add(user.userId);
        users.push(user);
        actorByPerson.set(actor.personId, actor);
    }

    // Roles: una sola petición por lote a GET /user-roles. Antes se pedía uno por
    // usuario, lo que con 88 cuentas eran 88 viajes de ida y vuelta (~3 min). Si el
    // endpoint por lote no está disponible todavía (gateway sin la ruta), se cae al
    // camino uno-a-uno con concurrencia acotada en vez de quedarse sin roles.
    // Ambas cargas secundarias viajan a la vez: no dependen una de la otra.
    const [rolesByUser, teacherCourses] = await Promise.all([
        optional(rolesForUsers(users.map((user) => user.userId)), null),
        optional(instructorCourseNamesByPerson(), new Map()),
    ]);
    const roles = rolesByUser
        ? users.map((user) => roleNamesFrom(rolesByUser.get(user.userId) ?? []))
        : await rolesOneByOne(users);

    return users.map((user, index) => {
        const person = persons.get(user.personId);
        const actor = actorByPerson.get(user.personId) ?? null;
        const role = toUiRole(roles[index]);
        const courseNames = teacherCourses.get(user.personId) ?? [];

        return {
            id: user.userId,
            name: fullName(person) || user.username,
            email: person?.email ?? "",
            documentNumber: person?.documentNumber ?? "",
            documentType: person?.documentType ?? "",
            bloodType: person?.bloodType ?? "",
            birthDate: person?.birthDate ? String(person.birthDate).slice(0, 10) : "",
            address: person?.address ?? "",
            phone: person?.phone ?? "",
            role,
            code: user.username, // no hay "code" en el backend
            // Vínculo académico (desde academic_actor) para mostrar en la edición:
            // el backend no expone PATCH sobre el actor, así que son de solo lectura.
            actorId: actor?.academicActorId ?? null,
            actorCode: actor?.actorCode ?? "",
            schoolId: actor?.schoolId != null ? String(actor.schoolId) : null,
            department: null, // no expuesto por el backend
            course: role === "teacher" && courseNames.length ? courseNames.join(", ") : null,
            status: normalizeStatus(user.status),
            personId: user.personId,
            username: user.username,
        };
    });
}

/**
 * Carga todos los usuarios: API primero, mocks como respaldo,
 * fusionados con las altas hechas localmente en la UI.
 */
export async function loadUsers() {
    const local = await localUsers();
    try {
        return [...(await usersFromApi()), ...local];
    } catch (error) {
        if (API_MODE === "mock") {
            console.warn("[FaceAttend] loadUsers: API no disponible, uso mock —", error?.message);
            return [...mockAppUsers, ...local];
        }
        throw error;
    }
}

// ── Escritura local (pendiente de cablear al backend) ─────

export async function saveUsers(users) {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    } catch (error) { /* fallo silencioso */ }
}

export async function addUser(existing, draft) {
    const newUser = { id: generateId(), ...draft };
    const updated = [...existing, newUser];
    await saveUsers(updated);
    return updated;
}

export async function updateUser(existing, id, patch) {
    const updated = existing.map(u => u.id === id ? { ...u, ...patch } : u);
    await saveUsers(updated);
    return updated;
}

export async function deleteUser(existing, id) {
    const updated = existing.filter(u => u.id !== id);
    await saveUsers(updated);
    return updated;
}
