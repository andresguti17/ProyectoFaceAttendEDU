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
import { SecurityMeter } from "../../components/settings/tabs";
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
    TwoFactorRow,
    SessionTimeInput,
    AccentBlock,
} from "./sections";
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
                sessionTime: parseInt(cfg.sessionTime),
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
                header={<SecurityMeter twoFactor={config.twoFactor} sessionTime={config.sessionTime} />}
                sections={[
                    <TwoFactorRow
                        value={config.twoFactor}
                        onToggle={() => updateConfig("twoFactor", !config.twoFactor)}
                        description={t("Requiere un código adicional al iniciar sesión. Protege la cuenta aunque alguien obtenga tu contraseña.")}
                        warningText={t("Sin 2FA, la cuenta queda vulnerable si la contraseña se compromete. Se recomienda activarlo.")}
                    />,
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
