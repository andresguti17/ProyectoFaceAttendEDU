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
import { syncAcademicPeriodFromSettings } from "../../../services/api/periodSync";
import { pushInstitutionConfig, loadBackendOverrides, parseSetting } from "../../../services/api/settingsPersistence";
import { hasSuperAdminRole } from "../../../core/utils/backendRoles";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useDateFormat } from "../../components/hooks/useDateFormat";
import { useEditableConfig } from "../../components/hooks/useEditableConfig";
import {
    GeneralSettings,
    FaceSettings,
    NotificationsSettings,
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
} from "./sections";
import { FutureNotice } from "./sections/FutureNotice";
import { useSettingsActions, RoleSecuritySettings, RoleAppearanceSettings } from "./sharedSections";
import {
    calendarPeriodDates,
    describePeriod,
    getCurrentPeriod,
    normalizeAcademicPeriodType,
    validatePeriodDates,
} from "../../../core/constants/academicPeriods";
import {
    getInstitutionConfig,
    updateInstitutionConfig,
    checkPeriodExpiration,
    onInstitutionConfigChange,
} from "../../../core/config/institutionConfig";

function buildInitialConfig(config) {
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
        tardyToleranceMinutes: config.tardyToleranceMinutes ?? 15,
        confidence: config.confidenceThreshold,
        autoRegister: config.autoRegister,
        emailAlert: config.emailAlert,
        weeklyReport: config.weeklyReport,
        atRiskAlert: config.atRiskAlert,
        dailySummary: config.dailySummary,
        pushNotifications: config.pushNotifications ?? true,
        pushDuration: config.pushDuration ?? 0,
        pushNotificationLimit: config.pushNotificationLimit ?? 15,
        pushNotificationLimitByType: config.pushNotificationLimitByType ?? 5,
        twoFactor: config.twoFactor,
        sessionTime: String(config.sessionTime),
    };
}

export function AdminSettings({ section, onSave, onDiscard, onDiscardColors, onSaveSuccessColors, previewAccent, onPreviewChange, previewTheme, onHasChanges, onColorChanges }) {
    const { isSmall } = useResponsive();
    const { currentLanguage, t } = useTranslation();
    const { user } = useAuth();
    const { dateFormat } = useDateFormat(); // Forzar re-render cuando cambie el formato

    // ── Estado no editable (UI temporal) ──────────────────────
    const [showExpirationAlert, setShowExpirationAlert] = useState(true);

    // ── Configuración inicial ─────────────────────────────────
    const initialConfig = useMemo(() => buildInitialConfig(getInstitutionConfig()), []);

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
            if (validatePeriodDates(cfg.periodStartDate, cfg.periodEndDate, cfg.academicPeriodType)) {
                return false;
            }
            const merged = {
                ...cfg,
                academicPeriodType: normalizeAcademicPeriodType(cfg.academicPeriodType),
                periodStartDate: cfg.periodStartDate || null,
                periodEndDate: cfg.periodEndDate || null,
                confidenceThreshold: cfg.confidence,
                sessionTime: Number.parseInt(cfg.sessionTime),
            };
            const success = updateInstitutionConfig(merged);
            if (!success) return false;
            // Réplica en el backend (upsert por clave); si falla, el
            // guardado se reporta como fallido para no mostrar éxito falso.
            try {
                await pushInstitutionConfig(user?.schoolId ?? null, merged, {
                    canWriteSecurity: hasSuperAdminRole(user?.roles),
                });
                // Académico debe reflejar el mismo período vigente que Configuración.
                await syncAcademicPeriodFromSettings(user?.schoolId ?? null, merged);
                return true;
            } catch {
                return false;
            }
        },
        onHasChanges,
    });

    // ── Sincronización con la sede ────────────────────────────
    // Al iniciar sesión (o tras recargar) los ajustes de la sede llegan DESPUÉS de
    // montar esta pantalla: si no hay cambios sin guardar, el formulario los toma.
    const hasChangesRef = useRef(false);
    useEffect(() => {
        hasChangesRef.current = hasChanges;
    }, [hasChanges]);
    useEffect(
        () =>
            onInstitutionConfigChange(() => {
                if (!hasChangesRef.current) reset(buildInitialConfig(getInstitutionConfig()));
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    // ── Registrar callbacks con el padre ──────────────────────
    useSettingsActions({ onSave, save, onDiscard, discard });

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
                merged.academicPeriodType = normalizeAcademicPeriodType(merged.academicPeriodType);
                if (merged.sessionTime != null) merged.sessionTime = String(merged.sessionTime);
                reset(merged);
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Derivados ─────────────────────────────────────────────
    const automaticPeriod = useMemo(() => {
        return getCurrentPeriod(config.academicPeriodType);
    }, [config.academicPeriodType, dateFormat]); // Añadir dateFormat como dependencia

    // Período según lo que se está editando (no lo ya guardado): tipo + fechas del borrador.
    const draftPeriod = useMemo(
        () => describePeriod(config.periodStartDate, config.periodEndDate, config.academicPeriodType),
        [config.periodStartDate, config.periodEndDate, config.academicPeriodType]
    );

    // Cambiar el tipo en modo automático (o sin fechas) recalcula las fechas con la división
    // del año del nuevo tipo; en manual se conservan y el selector avisa si ya no encajan.
    const handlePeriodTypeChange = (value) => {
        updateConfig("academicPeriodType", value);
        if (config.isAutomaticPeriod || (!config.periodStartDate && !config.periodEndDate)) {
            const { startIso, endIso } = calendarPeriodDates(value);
            updateConfig("periodStartDate", startIso);
            updateConfig("periodEndDate", endIso);
        }
    };

    // Pasar a automático sin fechas las completa con el período del calendario.
    const handlePeriodModeChange = (automatic) => {
        updateConfig("isAutomaticPeriod", automatic);
        if (automatic && !config.periodStartDate && !config.periodEndDate) {
            const { startIso, endIso } = calendarPeriodDates(config.academicPeriodType);
            updateConfig("periodStartDate", startIso);
            updateConfig("periodEndDate", endIso);
        }
    };

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
                        onPeriodTypeChange={handlePeriodTypeChange}
                        isSmall={isSmall}
                        nameLocked={user?.schoolId != null}
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
                        onModeChange={handlePeriodModeChange}
                        academicPeriodType={config.academicPeriodType}
                        automaticPeriod={automaticPeriod}
                        currentPeriod={draftPeriod}
                        hasSchool={user?.schoolId != null}
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
                        currentPeriod={draftPeriod}
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
                        tardyToleranceMinutes={config.tardyToleranceMinutes}
                        onTardyToleranceChange={(value) => updateConfig("tardyToleranceMinutes", value)}
                    />,
                    <ConfidenceSlider
                        value={config.confidence}
                        onChange={(value) => updateConfig("confidence", value)}
                    />,
                    <FaceToggles
                        confidence={config.confidence}
                        autoRegister={config.autoRegister}
                        onAutoRegister={() => updateConfig("autoRegister", !config.autoRegister)}
                    />,
                ]}
            />
        ),
        notifications: (
            <NotificationsSettings
                sections={[
                    <FutureNotice message={t("Los correos (ausencias de la clase, estudiantes en riesgo, resumen diario y reporte semanal) llegan a las direcciones registradas de docentes y administradores de la sede, según lo que actives aquí.")} />,
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
            <RoleSecuritySettings
                sessionTime={config.sessionTime}
                onSessionTimeChange={(value) => updateConfig("sessionTime", value)}
                shortSessionHint={t(" Sesión muy corta — el usuario deberá iniciar sesión con frecuencia.")}
                normalSessionHint={t(" Tiempo razonable para uso normal en aula.")}
                notices={user?.schoolId != null ? [
                    <FutureNotice message={t("El tiempo de sesión es global de la plataforma: lo define el Super Administrador. Tu cambio solo se aplica en este navegador.")} />,
                ] : []}
            />
        ),
        appearance: (
            <RoleAppearanceSettings
                onColorChanges={onColorChanges}
                onDiscardColors={onDiscardColors}
                onSaveSuccessColors={onSaveSuccessColors}
                previewTheme={previewTheme}
            />
        ),
    };

    return (
        <Card style={{ flex: 1 }}>
            {sectionMap[section] ?? null}
        </Card>
    );
}
