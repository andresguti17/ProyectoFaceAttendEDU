// ============================================================
//  FaceAttend EDU — Locale (i18n · Intl)
//
//  Locale Intl (BCP 47) del idioma activo, para formatear fechas,
//  números y moneda con la API Intl (ADR-017). Fuera de React, así
//  que lo pueden usar utils y viewmodels.
// ============================================================

import i18n from "../../locales";

// es-CO: la institución de referencia es colombiana (SENA).
const INTL_LOCALES = { es: "es-CO", en: "en-US", pt: "pt-BR", fr: "fr-FR" };

export function getLocale() {
    return INTL_LOCALES[i18n.resolvedLanguage || i18n.language] || INTL_LOCALES.es;
}

/** Fecha y hora corta del idioma activo ("24/10/2026, 14:05" / "10/24/2026, 2:05 PM"). */
export function formatDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: "short", timeStyle: "short" }).format(date);
}
