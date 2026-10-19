// ============================================================
//  FaceAttend EDU — Persistencia de ajustes en el backend
//
//  Replica los campos de institutionConfig con contraparte en el
//  backend (ms-configuration) usando claves `web.*` para no chocar
//  con las nativas (session_timeout_minutes, ...):
//  - académicas (por sede): POST/PUT /configurations/academic
//  - seguridad (globales):  POST/PUT /configurations/security
//
//  Upsert por nombre: si la clave ya existe se actualiza (PUT),
//  si no se crea (POST). Valores siempre en string.
// ============================================================

import { configurationApi } from "./configurationApi";

// Campos de institutionConfig con réplica académica (por sede).
export const ACADEMIC_FIELD_NAMES = {
    minAttendance: "web.min_attendance",
    daysUntilSanction: "web.days_until_sanction",
    confidence: "web.facial_confidence",
    confidenceThreshold: "web.facial_confidence",
    autoRegister: "web.facial_auto_register",
    savePhotos: "web.facial_save_photos",
    emailAlert: "web.notify_email_alert",
    weeklyReport: "web.notify_weekly_report",
    atRiskAlert: "web.notify_at_risk",
    dailySummary: "web.notify_daily_summary",
    pushNotifications: "web.notify_push",
    pushDuration: "web.notify_push_duration",
};

// Campos con réplica global de seguridad.
export const SECURITY_FIELD_NAMES = {
    twoFactor: "web.two_factor",
    sessionTime: "web.session_time",
};

function recordListOf(response) {
    if (Array.isArray(response)) return response;
    return response?.content ?? [];
}

function recordIdOf(record) {
    return record?.configurationId ?? record?.configuration_id ?? record?.id ?? null;
}

function recordNameOf(record) {
    return record?.configurationName ?? record?.configuration_name ?? "";
}

function recordValueOf(record) {
    const value = record?.configurationValue ?? record?.configuration_value ?? "";
    return value == null ? "" : String(value);
}

export function stringifySetting(value) {
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value ?? "");
}

export function parseSetting(raw, fallback) {
    if (raw == null || raw === "") return fallback;
    if (typeof fallback === "boolean") return raw === "true";
    if (typeof fallback === "number") {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return raw;
}

async function upsertAcademic(schoolId, existing, name, value) {
    const found = existing.find((r) => recordNameOf(r) === name);
    if (found) {
        await configurationApi.updateAcademic(recordIdOf(found), {
            configurationValue: value,
        });
    } else {
        await configurationApi.createAcademic({
            schoolId,
            configurationName: name,
            configurationValue: value,
        });
    }
}

async function upsertSecurity(existing, name, value) {
    const found = existing.find((r) => recordNameOf(r) === name);
    if (found) {
        await configurationApi.updateSecurity(recordIdOf(found), {
            configurationValue: value,
        });
    } else {
        await configurationApi.createSecurity({
            configurationName: name,
            configurationValue: value,
        });
    }
}

/**
 * Sube los ajustes al backend (upsert por clave).
 * Las claves académicas son por sede (requieren schoolId); las de
 * seguridad son globales y se guardan siempre. Sin sede solo se
 * persiste seguridad, nunca se finge el resto.
 * @throws si falla alguna escritura.
 */
export async function pushInstitutionConfig(schoolId, config) {
    const source = config ?? {};
    const [existingAcademic, existingSecurity] = await Promise.all([
        schoolId != null
            ? recordListOf(await configurationApi.schoolConfigurations(schoolId))
            : [],
        recordListOf(await configurationApi.listSecurity()),
    ]);

    const academicJobs =
        schoolId == null
            ? []
            : Object.entries(ACADEMIC_FIELD_NAMES)
                  .filter(([field]) => source[field] !== undefined)
                  .map(([field, name]) =>
                      upsertAcademic(schoolId, existingAcademic, name, stringifySetting(source[field]))
                  );
    const securityJobs = Object.entries(SECURITY_FIELD_NAMES)
        .filter(([field]) => source[field] !== undefined)
        .map(([field, name]) =>
            upsertSecurity(existingSecurity, name, stringifySetting(source[field]))
        );
    await Promise.all([...academicJobs, ...securityJobs]);
}

/**
 * Lee las réplicas del backend y devuelve overrides parciales con los
 * tipos de institutionConfig (para una futura sincronización de carga).
 */
export async function loadBackendOverrides(schoolId) {
    if (schoolId == null) return {};
    const [academic, security] = await Promise.all([
        recordListOf(await configurationApi.schoolConfigurations(schoolId)),
        recordListOf(await configurationApi.listSecurity()),
    ]);
    const byName = new Map();
    for (const record of [...academic, ...security]) {
        byName.set(recordNameOf(record), recordValueOf(record));
    }
    const overrides = {};
    for (const [field, name] of Object.entries({
        ...ACADEMIC_FIELD_NAMES,
        ...SECURITY_FIELD_NAMES,
    })) {
        if (byName.has(name)) overrides[field] = byName.get(name);
    }
    return overrides;
}
