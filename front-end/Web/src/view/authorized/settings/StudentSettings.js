// ============================================================
//  FaceAttend EDU — StudentSettings
//
//  El estudiante define QUÉ secciones ve, CON QUÉ DATOS y EN
//  QUÉ ORDEN. Configuración mínima: seguridad y apariencia.
//  Los textos son en primera persona ("tu cuenta", "deberás").
//
//  Secciones: security · appearance
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
    AtRiskAlertToggle,
    PushNotificationToggle,
    PushNotificationLimit,
    TwoFactorRow,
    SessionTimeInput,
    AccentBlock,
} from "./sections";
import {
    getInstitutionConfig,
    updateInstitutionConfig,
} from "../../../core/config/institutionConfig";

export function StudentSettings({ section, onSave, onDiscard, onDiscardColors, onSaveSuccessColors, previewAccent, onPreviewChange, previewTheme, onHasChanges, onColorChanges }) {
    const { t } = useTranslation();

    // ── Configuración inicial ─────────────────────────────────
    const initialConfig = useMemo(() => {
        const cfg = getInstitutionConfig();
        return {
            atRiskAlert: cfg.atRiskAlert ?? true,
            pushNotifications: cfg.pushNotifications ?? true,
            pushDuration: cfg.pushDuration ?? 0,
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
                atRiskAlert: cfg.atRiskAlert,
                pushNotifications: cfg.pushNotifications,
                pushDuration: cfg.pushDuration,
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
                    <AtRiskAlertToggle
                        value={config.atRiskAlert}
                        onToggle={() => updateConfig("atRiskAlert", !config.atRiskAlert)}
                        targetRole="self"
                        description={`${t("Recibe una notificación cuando tu asistencia cae por debajo del")} ${config.minAttendance}% ${t("mínimo requerido. Te ayuda a estar al tanto de tu progreso académico.")}`}
                    />,
                    <PushNotificationToggle
                        enabled={config.pushNotifications}
                        onToggle={() => updateConfig("pushNotifications", !config.pushNotifications)}
                        duration={config.pushDuration}
                        onDurationChange={(value) => updateConfig("pushDuration", value)}
                        description={t("Notificaciones emergentes sobre tu asistencia y actualizaciones del sistema.")}
                    />,
                    ...(config.pushNotifications ? [
                        <PushNotificationLimit
                            limit={config.pushNotificationLimit}
                            limitByType={config.pushNotificationLimitByType}
                            onLimitChange={(value) => updateConfig("pushNotificationLimit", value)}
                            onLimitByTypeChange={(value) => updateConfig("pushNotificationLimitByType", value)}
                        />
                    ] : []),
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
                        description={t("Requiere un código adicional al iniciar sesión. Protege tu cuenta aunque alguien obtenga tu contraseña.")}
                        warningText={t("Sin 2FA, tu cuenta queda vulnerable si la contraseña se compromete. Se recomienda activarlo.")}
                    />,
                    <SessionTimeInput
                        value={config.sessionTime}
                        onChange={(value) => updateConfig("sessionTime", value)}
                        contextHint={(min) =>
                            min > 120 ? t(" ⚠ Sesiones largas aumentan el riesgo si el dispositivo queda desbloqueado.")
                            : min <= 15 ? t(" Sesión muy corta — deberás iniciar sesión con frecuencia.")
                            : t(" Tiempo razonable para uso normal.")
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
