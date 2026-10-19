// ============================================================
//  FaceAttend EDU — AdminSettings
//
//  El admin define QUÉ secciones ve, CON QUÉ DATOS y EN QUÉ
//  ORDEN. Todo el estado vive aquí. Los modals solo renderizan
//  lo que reciben.
//
//  Secciones: general · facial (con umbrales de asistencia) · notifications · security · appearance
// ============================================================

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "../../components/common";
import { useAuth } from "../../../context/AuthContext";
import { pushInstitutionConfig, loadBackendOverrides, parseSetting } from "../../../services/api/settingsPersistence";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useDateFormat } from "../../components/hooks/useDateFormat";
import { useEditableConfig } from "../../components/hooks/useEditableConfig";
import { SecurityMeter } from "../../components/settings/tabs";
import {
    GeneralSettings,
    FaceSettings,
    NotificationsSettings,
    SecuritySettings,
    AppearanceSettings,
} from "./modals";
import {
    InstitutionInfo,
    PeriodConfig,
    AttendanceThresholds,
    GeneralSummary,
    LanguageBlock,
    DateFormatBlock,
    ConfidenceSlider,
    FaceToggles,
    EmailAlertToggle,
    WeeklyReportToggle,
    AtRiskAlertToggle,
    DailySummaryToggle,
    PushNotificationToggle,
    PushNotificationLimit,
    TwoFactorRow,
    SessionTimeInput,
    AccentBlock,
} from "./sections";
import {
    getCurrentPeriod,
} from "../../../core/constants/academicPeriods";
import {
    getInstitutionConfig,
    updateInstitutionConfig,
    checkPeriodExpiration,
} from "../../../core/config/institutionConfig";

export function AdminSettings({ section, onSave, onDiscard, onDiscardColors, onSaveSuccessColors, previewAccent, onPreviewChange, previewTheme, onHasChanges, onColorChanges }) {
    const { isSmall } = useResponsive();
    const { currentLanguage, t } = useTranslation();
    const { user } = useAuth();
    const { dateFormat } = useDateFormat(); // Forzar re-render cuando cambie el formato

    // ── Estado no editable (UI temporal) ──────────────────────
    const [showExpirationAlert, setShowExpirationAlert] = useState(true);

    // ── Configuración inicial ─────────────────────────────────
    const initialConfig = useMemo(() => {
        const config = getInstitutionConfig();
        return {
            institutionName: config.institutionName,
            institutionSlug: config.institutionSlug,
            academicPeriodType: config.academicPeriodType,
            periodStartDate: config.periodStartDate || "",
            periodEndDate: config.periodEndDate || "",
            isAutomaticPeriod: config.isAutomaticPeriod ?? true,
            dateFormat: config.dateFormat || "DD/MM/YYYY",
            timeFormat24h: config.timeFormat24h ?? false,
            minAttendance: config.minAttendance,
            daysUntilSanction: config.daysUntilSanction,
            consecutiveDaysForSanction: config.consecutiveDaysForSanction ?? 3,
            confidence: config.confidenceThreshold,
            autoRegister: config.autoRegister,
            savePhotos: config.savePhotos,
            emailAlert: config.emailAlert,
            weeklyReport: config.weeklyReport,
            atRiskAlert: config.atRiskAlert,
            dailySummary: config.dailySummary,
            pushNotifications: config.pushNotifications ?? true,
            pushDuration: config.pushDuration ?? 0,
            twoFactor: config.twoFactor,
            sessionTime: String(config.sessionTime),
        };
    }, []);

    // ── Hook genérico de configuración editable ───────────────
    const {
        config,
        updateConfig,
        hasChanges,
        save,
        discard,
        reset,
    } = useEditableConfig(initialConfig, {
        onSave: async (cfg) => {
            // Transformar sessionTime a número antes de guardar
            const merged = {
                ...cfg,
                confidenceThreshold: cfg.confidence,
                sessionTime: parseInt(cfg.sessionTime),
            };
            const success = updateInstitutionConfig(merged);
            if (!success) return false;
            // Réplica en el backend (upsert por clave); si falla, el
            // guardado se reporta como fallido para no mostrar éxito falso.
            try {
                await pushInstitutionConfig(user?.schoolId ?? null, merged);
                return true;
            } catch {
                return false;
            }
        },
        onHasChanges,
    });

    // ── Registrar callbacks con el padre ──────────────────────
    useEffect(() => {
        if (onSave) onSave(save);
    }, [onSave, save]);

    // ── Hidratación desde el backend ──────────────────────────
    // La réplica web.* por sede es la fuente compartida entre
    // dispositivos: al abrir se fusiona sobre los valores locales.
    // Si el backend no responde, se conserva lo local sin errores.
    useEffect(() => {
        let alive = true;
        loadBackendOverrides(user?.schoolId ?? null)
            .then((overrides) => {
                if (!alive) return;
                const keys = Object.keys(overrides).filter((k) => k in initialConfig);
                if (keys.length === 0) return;
                const merged = { ...initialConfig };
                for (const key of keys) {
                    merged[key] = parseSetting(overrides[key], initialConfig[key]);
                }
                if (merged.sessionTime != null) merged.sessionTime = String(merged.sessionTime);
                reset(merged);
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (onDiscard) onDiscard(discard);
    }, [onDiscard, discard]);

    // ── Derivados ─────────────────────────────────────────────
    const automaticPeriod = useMemo(() => {
        return getCurrentPeriod(config.academicPeriodType);
    }, [config.academicPeriodType, dateFormat]); // Añadir dateFormat como dependencia

    const periodExpiration = useMemo(() => {
        return checkPeriodExpiration();
    }, [config.periodStartDate, config.periodEndDate]);

    useEffect(() => {
        if (periodExpiration?.hasExpired || periodExpiration?.isExpiringSoon) {
            setShowExpirationAlert(true);
        }
    }, [periodExpiration]);

    // ── Mapa de secciones por clave ───────────────────────────
    const sectionMap = {
        general: (
            <GeneralSettings
                title={t("General")}
                sections={[
                    <InstitutionInfo
                        institutionName={config.institutionName}
                        onNameChange={(value) => updateConfig("institutionName", value)}
                        institutionSlug={config.institutionSlug}
                        onSlugChange={(value) => updateConfig("institutionSlug", value)}
                        academicPeriodType={config.academicPeriodType}
                        onPeriodTypeChange={(value) => updateConfig("academicPeriodType", value)}
                        isSmall={isSmall}
                    />,
                    <LanguageBlock />,
                    <DateFormatBlock
                        dateFormat={config.dateFormat}
                        onDateFormatChange={(value) => updateConfig("dateFormat", value)}
                        timeFormat24h={config.timeFormat24h}
                        onTimeFormatChange={(value) => updateConfig("timeFormat24h", value)}
                    />,
                    <PeriodConfig
                        periodStartDate={config.periodStartDate}
                        onStartDateChange={(value) => updateConfig("periodStartDate", value)}
                        periodEndDate={config.periodEndDate}
                        onEndDateChange={(value) => updateConfig("periodEndDate", value)}
                        isAutomaticPeriod={config.isAutomaticPeriod}
                        onModeChange={(value) => updateConfig("isAutomaticPeriod", value)}
                        academicPeriodType={config.academicPeriodType}
                        automaticPeriod={automaticPeriod}
                        periodExpiration={periodExpiration}
                        showExpirationAlert={showExpirationAlert}
                        onDismissExpiration={() => setShowExpirationAlert(false)}
                    />,
                    <GeneralSummary
                        institutionName={config.institutionName}
                        academicPeriodType={config.academicPeriodType}
                        periodStartDate={config.periodStartDate}
                        periodEndDate={config.periodEndDate}
                        isAutomaticPeriod={config.isAutomaticPeriod}
                        automaticPeriod={automaticPeriod}
                        currentLanguageLabel={currentLanguage?.labelES}
                        dateFormat={config.dateFormat}
                        timeFormat24h={config.timeFormat24h}
                    />,
                ]}
            />
        ),
        facial: (
            <FaceSettings
                title={t("Reconocimiento facial")}
                sections={[
                    <AttendanceThresholds
                        minAttendance={config.minAttendance}
                        onMinAttendanceChange={(value) => updateConfig("minAttendance", value)}
                        daysUntilSanction={config.daysUntilSanction}
                        onDaysSanctionChange={(value) => updateConfig("daysUntilSanction", value)}
                        consecutiveDaysForSanction={config.consecutiveDaysForSanction}
                        onConsecutiveDaysChange={(value) => updateConfig("consecutiveDaysForSanction", value)}
                    />,
                    <ConfidenceSlider
                        value={config.confidence}
                        onChange={(value) => updateConfig("confidence", value)}
                    />,
                    <FaceToggles
                        confidence={config.confidence}
                        autoRegister={config.autoRegister}
                        onAutoRegister={() => updateConfig("autoRegister", !config.autoRegister)}
                        savePhotos={config.savePhotos}
                        onSavePhotos={() => updateConfig("savePhotos", !config.savePhotos)}
                    />,
                ]}
            />
        ),
        notifications: (
            <NotificationsSettings
                sections={[
                    <EmailAlertToggle
                        value={config.emailAlert}
                        onToggle={() => updateConfig("emailAlert", !config.emailAlert)}
                        description={t("Envía un correo al docente cuando un estudiante no asiste. Ideal para clases pequeñas o con seguimiento individual.")}
                    />,
                    <WeeklyReportToggle
                        value={config.weeklyReport}
                        onToggle={() => updateConfig("weeklyReport", !config.weeklyReport)}
                        description={t("Resumen automático de asistencia enviado cada lunes a las 8am. Incluye porcentajes por curso.")}
                    />,
                    <AtRiskAlertToggle
                        value={config.atRiskAlert}
                        onToggle={() => updateConfig("atRiskAlert", !config.atRiskAlert)}
                        targetRole="instructor"
                        description={`${t("Notifica cuando un instructor cae por debajo del")} ${config.minAttendance}% ${t("de asistencia mínima configurado en Reconocimiento.")}`}
                    />,
                    <DailySummaryToggle
                        value={config.dailySummary}
                        onToggle={() => updateConfig("dailySummary", !config.dailySummary)}
                        description={t("Resumen automático de asistencia al finalizar el día. Puede generar muchas notificaciones en días de muchas clases.")}
                    />,
                    <PushNotificationToggle
                        enabled={config.pushNotifications}
                        onToggle={() => updateConfig("pushNotifications", !config.pushNotifications)}
                        duration={config.pushDuration}
                        onDurationChange={(value) => updateConfig("pushDuration", value)}
                        description={t("Notificaciones emergentes en tiempo real del sistema.")}
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
