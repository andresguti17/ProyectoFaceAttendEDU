// ============================================================
//  FaceAttend EDU — Secciones comunes de configuración por rol
//
//  Seguridad (2FA + tiempo de sesión) y apariencia son iguales para
//  administrador, profesor y estudiante; solo cambian los textos de
//  ayuda del tiempo de sesión y los avisos previos.
// ============================================================

import React, { useEffect } from "react";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { SecuritySettings, AppearanceSettings } from "./modals";
import { TwoFactorSetup, OwnSecurityMeter, SessionTimeInput, AccentBlock } from "./sections";

/** Entrega al padre las acciones de guardar y descartar del formulario. */
export function useSettingsActions({ onSave, save, onDiscard, discard }) {
    useEffect(() => {
        if (onSave) onSave(save);
    }, [onSave, save]);

    useEffect(() => {
        if (onDiscard) onDiscard(discard);
    }, [onDiscard, discard]);
}

/**
 * @param {string} shortSessionHint - ayuda para sesiones de 15 min o menos
 * @param {string} normalSessionHint - ayuda para sesiones de 16 a 120 min
 * @param {Array} notices - avisos antes de las opciones (opcional)
 */
export function RoleSecuritySettings({ sessionTime, onSessionTimeChange, shortSessionHint, normalSessionHint, notices = [] }) {
    const { t } = useTranslation();
    return (
        <SecuritySettings
            title={t("Seguridad")}
            header={<OwnSecurityMeter sessionTime={sessionTime} />}
            sections={[
                ...notices,
                <TwoFactorSetup />,
                <SessionTimeInput
                    value={sessionTime}
                    onChange={onSessionTimeChange}
                    contextHint={(min) =>
                        min > 120 ? t(" ⚠ Sesiones largas aumentan el riesgo si el dispositivo queda desbloqueado.")
                        : min <= 15 ? shortSessionHint
                        : normalSessionHint
                    }
                />,
            ]}
        />
    );
}

export function RoleAppearanceSettings({ onColorChanges, onDiscardColors, onSaveSuccessColors, previewTheme }) {
    const { t } = useTranslation();
    return (
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
    );
}
