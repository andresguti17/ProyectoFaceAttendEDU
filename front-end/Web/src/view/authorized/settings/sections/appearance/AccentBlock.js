// ============================================================
//  AccentBlock — Selector de tema y paleta semántica completa
//  Editor de modo (claro/oscuro) y colores con preview aislado.
//
//  Los cambios solo afectan el PREVIEW hasta que el usuario presione "Guardar cambios".
//  Entonces se aplican a toda la UI via ThemeContext.applyColors(), setMode() y setVisionMode().
//
//  Props:
//   - onColorsExport  : (customColors) => void - [DEPRECADO] Ya no necesario
//   - onHasChanges    : (hasChanges: boolean) => void - Notifica cambios sin guardar
//   - onDiscardRegister: (discardFn) => void - Registra función de descarte
//   - onSaveSuccessRegister: (saveFn) => void - Registra función de guardado
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { AccentColorSelector } from "../../../../components/settings/tabs";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function AccentBlock({ onColorsExport, onHasChanges, onDiscardRegister, onSaveSuccessRegister }) {
    const { t } = useTranslation();
    const { labelStyle, descStyle } = useSettingsSectionStyles();

    return (
        <View style={{ gap: 4 }}>
            {/* Selector de tema y paleta de colores integrado */}
            <View>
                <Text style={labelStyle}>{t("Tema y paleta de colores")}</Text>
                <Text style={[descStyle, { marginTop: -4, lineHeight: 22 }]}>
                    {t("Personaliza el modo de visualización (claro/oscuro) y los colores semánticos de la aplicación: Primario (interacción), Correcto (éxitos), Advertencias, Errores y Fuentes. Los cambios se previsualizan en tiempo real. Presiona \"Guardar cambios\" para aplicarlos en toda la aplicación.")}
                </Text>
            </View>

            {/* Selector de colores autónomo */}
            <AccentColorSelector
                onColorsExport={onColorsExport}
                onHasChanges={onHasChanges}
                onDiscardRegister={onDiscardRegister}
                onSaveSuccessRegister={onSaveSuccessRegister}
            />
        </View>
    );
}
