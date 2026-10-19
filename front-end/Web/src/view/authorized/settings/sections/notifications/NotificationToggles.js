// ============================================================
//  Notification Sections — Componentes individuales de notificación
//  Cada tipo de notificación es una sección independiente.
// ============================================================
import React from "react";
import { ToggleRow, Divider } from "../../../../components/common";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";

// ── Email Alert ───────────────────────────────────────────
export function EmailAlertToggle({ value, onToggle, description }) {
    const { t } = useTranslation();
    return (
        <>
            <ToggleRow
                label={t("Alertas por correo")}
                description={description}
                value={value}
                onToggle={onToggle}
            />
            <Divider />
        </>
    );
}

// ── Weekly Report ─────────────────────────────────────────
export function WeeklyReportToggle({ value, onToggle, description }) {
    const { t } = useTranslation();
    return (
        <>
            <ToggleRow
                label={t("Reporte semanal")}
                description={description}
                value={value}
                onToggle={onToggle}
            />
            <Divider />
        </>
    );
}

// ── At Risk Alert (Genérico y parametrizable por rol) ────
/**
 * Componente genérico para alertas de riesgo.
 * Configurable según el rol del usuario:
 * - Admin: alertas sobre instructores/profesores
 * - Teacher: alertas sobre aprendices
 * - Student: alertas sobre ellos mismos
 * 
 * @param {Object} props
 * @param {boolean} props.value - Estado del toggle
 * @param {Function} props.onToggle - Callback al cambiar el toggle
 * @param {string} props.label - Etiqueta personalizada según el rol
 * @param {string} props.description - Descripción personalizada según el rol
 * @param {string} props.targetRole - Rol objetivo de la alerta ("instructor"|"student"|"self")
 */
export function AtRiskAlertToggle({ value, onToggle, label, description, targetRole = "student" }) {
    const { t } = useTranslation();
    
    // Etiquetas por defecto según targetRole si no se proporciona una personalizada
    const defaultLabels = {
        instructor: t("Alerta de instructores en riesgo"),
        student: t("Alerta de estudiantes en riesgo"),
        self: t("Alerta de asistencia personal"),
    };
    
    return (
        <>
            <ToggleRow
                label={label || defaultLabels[targetRole] || defaultLabels.student}
                description={description}
                value={value}
                onToggle={onToggle}
            />
            <Divider />
        </>
    );
}

// ── Daily Summary ─────────────────────────────────────────
export function DailySummaryToggle({ value, onToggle, description }) {
    const { t } = useTranslation();
    return (
        <>
            <ToggleRow
                label={t("Resumen diario")}
                description={description}
                value={value}
                onToggle={onToggle}
            />
            <Divider />
        </>
    );
}
