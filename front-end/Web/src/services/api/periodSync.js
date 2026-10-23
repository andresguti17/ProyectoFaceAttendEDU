// ============================================================
//  FaceAttend EDU — Concordancia de períodos académicos
//
//  El período vigente vive en dos lugares: Configuración (tipo, fechas
//  y modo, claves web.* de ms-configuration) y Académico (tabla
//  academic_period de ms-academic, con is_active). Este módulo los
//  mantiene alineados en los dos sentidos:
//  - Configuración → Académico: el rango configurado existe como período
//    activo y ningún otro período activo se le solapa.
//  - Académico → Configuración: el período activo vigente (el que aún no
//    termina, el más próximo a empezar) fija las fechas de Configuración.
//  El tipo (anual/semestral/…) es de Configuración y rige la duración.
// ============================================================

import {
    calculateCurrentPeriodByYear,
    normalizeAcademicPeriodType,
} from "../../core/constants/academicPeriods";
import { getInstitutionConfig, updateInstitutionConfig } from "../../core/config/institutionConfig";
import { academicApi } from "./academicApi";
import { resetReferenceData } from "./referenceData";
import { pushInstitutionConfig } from "./settingsPersistence";

const day = (value) => String(value ?? "").slice(0, 10);

/** Fecha local de hoy (AAAA-MM-DD); toISOString() es UTC y cambia de día a las 7 pm en Colombia. */
export function todayLocalIso(date = new Date()) {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${m}-${d}`;
}

/** Nombre sugerido según el tipo y la fecha de inicio: "Primer Semestre 2026". */
export function periodNameFor(periodType, startIso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(startIso ?? ""));
    if (!m) return "";
    const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const { label } = calculateCurrentPeriodByYear(normalizeAcademicPeriodType(periodType), start);
    return `${label} ${start.getFullYear()}`;
}

function listOf(response) {
    if (Array.isArray(response)) return response;
    return response?.content ?? [];
}

/**
 * Período vigente entre los de la sede: activo, sin terminar y el que empieza primero.
 */
export function currentPeriodOf(periods, today = todayLocalIso()) {
    return (
        [...(periods ?? [])]
            .filter((p) => p?.isActive && day(p?.endsOn) >= today)
            .sort((a, b) => day(a.startsOn).localeCompare(day(b.startsOn)))[0] ?? null
    );
}

/** ¿Este período es el que está configurado como vigente en Configuración? */
export function isConfiguredPeriod(period, config = getInstitutionConfig()) {
    return (
        !!period &&
        !!config?.periodStartDate &&
        day(period.startsOn) === day(config.periodStartDate) &&
        day(period.endsOn) === day(config.periodEndDate)
    );
}

/**
 * Configuración → Académico. Garantiza un período activo con las fechas configuradas
 * y desactiva los activos que se le solapan (el modelo no admite dos a la vez).
 * @returns el período vigente, o null si no hay sede o fechas.
 */
export async function syncAcademicPeriodFromSettings(schoolId, config = getInstitutionConfig()) {
    const start = day(config?.periodStartDate);
    const end = day(config?.periodEndDate);
    if (schoolId == null || !start || !end) return null;

    const periods = listOf(await academicApi.listSchoolPeriods(schoolId));
    let current = periods.find((p) => day(p.startsOn) === start && day(p.endsOn) === end) ?? null;

    for (const p of periods) {
        if (p === current || !p.isActive) continue;
        if (start < day(p.endsOn) && end > day(p.startsOn)) {
            await academicApi.updatePeriod(p.academicPeriodId, { isActive: false });
        }
    }

    if (!current) {
        current = await academicApi.createPeriod({
            schoolId: Number(schoolId),
            name: periodNameFor(config?.academicPeriodType, start),
            startsOn: start,
            endsOn: end,
            isActive: true,
        });
    } else if (!current.isActive) {
        await academicApi.updatePeriod(current.academicPeriodId, { isActive: true });
        current = { ...current, isActive: true };
    }
    resetReferenceData();
    return current;
}

/**
 * Académico → Configuración. Si el período vigente de la sede no coincide con las fechas
 * de Configuración, las actualiza (local y en el backend de la sede).
 * @returns {Promise<boolean>} true si cambió Configuración.
 */
export async function alignSettingsWithPeriods(schoolId, periods) {
    const current = currentPeriodOf(periods);
    if (schoolId == null || !current || isConfiguredPeriod(current)) return false;
    const dates = { periodStartDate: day(current.startsOn), periodEndDate: day(current.endsOn) };
    if (!updateInstitutionConfig(dates)) return false;
    await pushInstitutionConfig(schoolId, dates, { canWriteSecurity: false });
    return true;
}
