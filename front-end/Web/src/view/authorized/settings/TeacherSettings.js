// ============================================================
//  FaceAttend EDU — TeacherSettings
//
//  El profesor define QUÉ secciones ve, CON QUÉ DATOS y EN QUÉ
//  ORDEN. Sin configuración de institución ni facial.
//
//  Secciones: notifications · security · appearance
// ============================================================

import React, { useState, useEffect, useMemo } from "react";
import { Card } from "../../components/common";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useEditableConfig } from "../../components/hooks/useEditableConfig";
import {
    NotificationsSettings,
    SecuritySettings,
    AppearanceSettings,
} from "./modals";
import {
    EmailAlertToggle,
    WeeklyReportToggle,
    AtRiskAlertToggle,
    DailySummaryToggle,
    TwoFactorSetup,
    OwnSecurityMeter,
    SessionTimeInput,
    AccentBlock,
} from "./sections";
import { FutureNotice } from "./sections/FutureNotice";
import {
    getInstitutionConfig,
    updateInstitutionConfig,
} from "../../../core/config/institutionConfig";

export function TeacherSettings({ section, onSave, onDiscard, onDiscardColors, onSaveSuccessColors, previewAccent, onPreviewChange, previewTheme, onHasChanges, onColorChanges }) {
    const { t } = useTranslation();

    // ── Configuración inicial ─────────────────────────────────
    const initialConfig = useMemo(() => {
        const cfg = getInstitutionConfig();
        return {
            emailAlert: cfg.emailAlert,
            weeklyReport: cfg.weeklyReport,
            atRiskAlert: cfg.atRiskAlert,
            dailySummary: cfg.dailySummary,
            minAttendance: cfg.minAttendance,
            twoFactor: cfg.twoFactor,
            sessionTime: String(cfg.sessionTime),
        };
    }, []);

    // ── Hook genérico de configuración editable ───────────────
    const {
        config,
        updateConfig,
        hasChanges,
        save,
        discard,
    } = useEditableConfig(initialConfig, {
        onSave: (cfg) => {
            const success = updateInstitutionConfig({
                emailAlert: cfg.emailAlert,
                weeklyReport: cfg.weeklyReport,
                atRiskAlert: cfg.atRiskAlert,
                dailySummary: cfg.dailySummary,
                twoFactor: cfg.twoFactor,
                sessionTime: Number.parseInt(cfg.sessionTime),
            });
            return success;
        },
        onHasChanges,
    });

    // ── Registrar callbacks con el padre ──────────────────────
    useEffect(() => {
        if (onSave) onSave(save);
    }, [onSave, save]);

    useEffect(() => {
        if (onDiscard) onDiscard(discard);
    }, [onDiscard, discard]);

    // ── Mapa de secciones por clave ───────────────────────────
    const sectionMap = {
        notifications: (
            <NotificationsSettings
                sections={[
                    <FutureNotice message={t("Los correos (ausencias de la clase, estudiantes en riesgo, resumen diario y reporte semanal) llegan a las direcciones registradas de docentes y administradores de la sede, según lo que actives aquí.")} />,
                    <EmailAlertToggle
                        value={config.emailAlert}
                        onToggle={() => updateConfig("emailAlert", !config.emailAlert)}
                        description={t("Envía un correo cuando un estudiante de tus cursos no asiste. Ideal para clases pequeñas o con seguimiento individual.")}
                    />,
                    <WeeklyReportToggle
                        value={config.weeklyReport}
                        onToggle={() => updateConfig("weeklyReport", !config.weeklyReport)}
                        description={t("Resumen automático de asistencia de tus cursos enviado cada lunes a las 8am.")}
                    />,
                    <AtRiskAlertToggle
                        value={config.atRiskAlert}
                        onToggle={() => updateConfig("atRiskAlert", !config.atRiskAlert)}
                        targetRole="student"
                        description={`${t("Notifica cuando un estudiante de tus cursos cae por debajo del")} ${config.minAttendance}% ${t("de asistencia mínima.")}`}
                    />,
                    <DailySummaryToggle
                        value={config.dailySummary}
                        onToggle={() => updateConfig("dailySummary", !config.dailySummary)}
                        description={t("Resumen automático de asistencia de tus cursos al finalizar el día.")}
                    />,
                ]}
            />
        ),
        security: (
            <SecuritySettings
                title={t("Seguridad")}
                header={<OwnSecurityMeter sessionTime={config.sessionTime} />}
                sections={[
                    <TwoFactorSetup />,
                    <SessionTimeInput
                        value={config.sessionTime}
                        onChange={(value) => updateConfig("sessionTime", value)}
                        contextHint={(min) =>
                            min > 120 ? t(" ⚠ Sesiones largas aumentan el riesgo si el dispositivo queda desbloqueado.")
                            : min <= 15 ? t(" Sesión muy corta — el usuario deberá iniciar sesión con frecuencia.")
                            : t(" Tiempo razonable para uso normal en aula.")
                        }
                    />,
                ]}
            />
        ),
        appearance: (
            <AppearanceSettings
                title={t("Apariencia")}
                sections={[
                    <AccentBlock
                        onHasChanges={onColorChanges}
                        onDiscardRegister={onDiscardColors}
                        onSaveSuccessRegister={onSaveSuccessColors}
                        previewTheme={previewTheme}
                    />,
                ]}
            />
        ),
    };

    return (
        <Card style={{ flex: 1 }}>
            {sectionMap[section] ?? null}
        </Card>
    );
}
