// ============================================================
//  FaceAttend EDU — Gestión de ambientes en el backend
//
//  POST/PUT/DELETE /api/v1/environments (ms-scheduling).
//  Crear exige schoolId + code + name + capacity positiva.
//  Los IDs del backend son numéricos; los locales empiezan por
//  "env_" y nunca tocan la red (se fusionan en el lector).
// ============================================================

import { academicApi } from "./academicApi";
import { schedulingApi } from "./schedulingApi";

export const LOCAL_ENV_PREFIX = "env_";

function envIdOf(response) {
    return (
        response?.environmentId ??
        response?.environment_id ??
        response?.id ??
        null
    );
}

/** ID numérico del backend o null si es un alta local. */
export function backendEnvId(envOrId) {
    const raw = typeof envOrId === "object" ? envOrId?.id : envOrId;
    if (raw == null || String(raw).trim() === "") return null;
    if (typeof raw === "string" && raw.startsWith(LOCAL_ENV_PREFIX)) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

async function resolveSchoolId(explicit) {
    if (explicit != null) return explicit;
    const schools = await academicApi.listSchools();
    const list = Array.isArray(schools) ? schools : schools?.content ?? [];
    if (list.length === 1) {
        const id = list[0]?.schoolId ?? list[0]?.school_id ?? null;
        if (id != null) return id;
    }
    throw new Error("No school context for the environment");
}

function checkedCapacity(capacity) {
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap <= 0) {
        throw new Error("Capacity must be a positive number");
    }
    return cap;
}

/**
 * Crea el ambiente y devuelve el espejo con el ID real del backend.
 */
export async function createEnvironment({ schoolId, code, name, capacity }) {
    const targetSchoolId = await resolveSchoolId(schoolId);
    if (!String(code ?? "").trim()) throw new Error("Environment code is required");
    const created = await schedulingApi.createEnvironment({
        schoolId: targetSchoolId,
        code: String(code).trim(),
        name: String(name ?? "").trim() || String(code).trim(),
        capacity: checkedCapacity(capacity),
        status: true,
    });
    const id = envIdOf(created);
    if (id == null) throw new Error("Environment creation returned no id");
    return {
        id: String(id),
        number: String(code).trim(),
        description: String(name ?? "").trim() || String(code).trim(),
        capacity: checkedCapacity(capacity),
        schedules: [],
    };
}

/**
 * Actualiza el ambiente en el backend (solo IDs numéricos).
 */
export async function updateEnvironment(id, { code, name, capacity }) {
    const backendId = backendEnvId(id);
    if (backendId == null) throw new Error("Environment is not synced with the backend yet");
    const body = {};
    if (code !== undefined) body.code = String(code).trim();
    if (name !== undefined) body.name = String(name).trim();
    if (capacity !== undefined) body.capacity = checkedCapacity(capacity);
    await schedulingApi.updateEnvironment(backendId, body);
}

/**
 * Elimina el ambiente en el backend (solo IDs numéricos).
 */
export async function deleteEnvironment(id) {
    const backendId = backendEnvId(id);
    if (backendId == null) throw new Error("Environment is not synced with the backend yet");
    await schedulingApi.deleteEnvironment(backendId);
}
