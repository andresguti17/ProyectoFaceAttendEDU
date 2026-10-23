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

import {
    getDefaultInstitutionConfig,
    getInstitutionConfig,
    saveInstitutionConfig,
} from "../../core/config/institutionConfig";
import { normalizeAcademicPeriodType } from "../../core/constants/academicPeriods";
import { academicApi } from "./academicApi";
import { configurationApi } from "./configurationApi";

// Sede a la que pertenecen los valores guardados en este navegador.
const CONFIG_SCHOOL_KEY = "faceattend_institution_school";

// Campos de institutionConfig con réplica académica (por sede).
export const ACADEMIC_FIELD_NAMES = {
    minAttendance: "web.min_attendance",
    daysUntilSanction: "web.days_until_sanction",
    confidence: "web.facial_confidence",
    confidenceThreshold: "web.facial_confidence",
    autoRegister: "web.facial_auto_register",
    emailAlert: "web.notify_email_alert",
    weeklyReport: "web.notify_weekly_report",
    atRiskAlert: "web.notify_at_risk",
    dailySummary: "web.notify_daily_summary",
    pushNotifications: "web.notify_push",
    pushDuration: "web.notify_push_duration",
    pushNotificationLimit: "web.notify_push_limit",
    pushNotificationLimitByType: "web.notify_push_limit_by_type",
    consecutiveDaysForSanction: "web.consecutive_days_sanction",
    // Clave nativa de ms-configuration (sembrada con 15): minutos antes de marcar tarde.
    tardyToleranceMinutes: "tardy_tolerance_minutes",
    academicPeriodType: "web.period_type",
    periodStartDate: "web.period_start",
    periodEndDate: "web.period_end",
    isAutomaticPeriod: "web.period_automatic",
    dateFormat: "web.date_format",
    timeFormat24h: "web.time_24h",
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
export async function pushInstitutionConfig(schoolId, config, { canWriteSecurity = true } = {}) {
    const source = config ?? {};
    // La seguridad es global de la plataforma: solo el Super Administrador la
    // escribe (el backend responde 403 al resto y haría fallar todo el guardado).
    const [existingAcademic, existingSecurity] = await Promise.all([
        schoolId != null
            ? recordListOf(await configurationApi.schoolConfigurations(schoolId))
            : [],
        canWriteSecurity ? recordListOf(await configurationApi.listSecurity()) : [],
    ]);

    // Dos campos pueden apuntar a la misma clave (confidence / confidenceThreshold):
    // se escribe una sola vez, o dos POST en paralelo chocarían con el UNIQUE por sede.
    const academicByName = new Map();
    for (const [field, name] of Object.entries(ACADEMIC_FIELD_NAMES)) {
        if (source[field] !== undefined && !academicByName.has(name)) {
            academicByName.set(name, stringifySetting(source[field]));
        }
    }
    const academicJobs =
        schoolId == null
            ? []
            : [...academicByName].map(([name, value]) =>
                  upsertAcademic(schoolId, existingAcademic, name, value)
              );
    const securityJobs = canWriteSecurity
        ? Object.entries(SECURITY_FIELD_NAMES)
              .filter(([field]) => source[field] !== undefined)
              .map(([field, name]) =>
                  upsertSecurity(existingSecurity, name, stringifySetting(source[field]))
              )
        : [];
    await Promise.all([...academicJobs, ...securityJobs]);
}

/**
 * Lee las réplicas del backend y devuelve overrides parciales con los
 * tipos de institutionConfig (para una futura sincronización de carga).
 */
export async function loadBackendOverrides(schoolId) {
    if (schoolId == null) return {};
    // De la seguridad global se leen solo las claves públicas (tiempo de sesión y 2FA),
    // que puede ver cualquier rol: así docentes y estudiantes usan el valor del Super
    // Administrador. Si falla, se conserva lo académico.
    const [academic, security] = await Promise.all([
        configurationApi.schoolConfigurations(schoolId).then(recordListOf),
        configurationApi.listSecurityPublic().then(recordListOf).catch(() => []),
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

const slugify = (text) =>
    String(text)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

function storedConfigSchool() {
    try {
        return localStorage.getItem(CONFIG_SCHOOL_KEY);
    } catch {
        return null;
    }
}

/**
 * Deja la configuración local con los valores de la sede de la sesión, para que
 * reportes, alertas y reconocimiento usen lo que definió el administrador de
 * ESA sede y no lo que quedó guardado en este navegador (clave única, sin sede).
 * Al cambiar de sede se parte de los valores por defecto, así no se arrastran
 * los ajustes de la sede anterior. Sin sede (Super Administrador) no hace nada.
 * @returns {Promise<boolean>} true si se aplicó.
 */
export async function syncInstitutionConfigFromBackend(schoolId) {
    if (schoolId == null) return false;
    const overrides = await loadBackendOverrides(schoolId);

    const sameSchool = storedConfigSchool() === String(schoolId);
    const defaults = getDefaultInstitutionConfig();
    const base = getInstitutionConfig();
    if (!sameSchool) {
        for (const field of Object.keys(ACADEMIC_FIELD_NAMES)) {
            if (field in defaults) base[field] = defaults[field];
        }
    }

    for (const [field, raw] of Object.entries(overrides)) {
        // En la UI de Ajustes el umbral se llama `confidence`; en la config, `confidenceThreshold`.
        const target = field === "confidence" ? "confidenceThreshold" : field;
        base[target] = parseSetting(raw, base[target]);
    }
    base.academicPeriodType = normalizeAcademicPeriodType(base.academicPeriodType);

    // El nombre institucional es el de la sede (se edita en Configuración > Sede).
    try {
        const school = await academicApi.getSchool(schoolId);
        if (school?.name) {
            base.institutionName = school.name;
            base.institutionSlug = slugify(school.name);
        }
    } catch {
        // sin acceso a la sede: se conserva lo que había
    }

    const saved = saveInstitutionConfig(base);
    try {
        localStorage.setItem(CONFIG_SCHOOL_KEY, String(schoolId));
    } catch {
        // sin almacenamiento: la próxima carga volverá a sincronizar
    }
    return saved;
}
