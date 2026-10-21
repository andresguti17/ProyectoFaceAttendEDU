// ============================================================
//  FaceToggles — Registro automático y aviso de fotos (futuro)
//  UI pura. Sin estado propio.
//
//  Props:
//   - confidence    : number — para la advertencia combinada
//   - autoRegister  : bool
//   - onAutoRegister: () => void
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ToggleRow } from "../../../../components/common";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function FaceToggles({ confidence, autoRegister, onAutoRegister }) {
    const { t } = useTranslation();
    const { c } = useSettingsSectionStyles();

    return (
        <View style={{ gap: 0 }}>
            <ToggleRow
                label={t("Registro automático")}
                description={t("Activado: el kiosco reconoce los rostros de forma continua por WebSocket. Desactivado: cada asistencia se registra pulsando un botón.")}
                value={autoRegister}
                onToggle={onAutoRegister}
            />

            {autoRegister && confidence < 75 && (
                <View style={{ marginTop: 8, backgroundColor: c.status.warningLight, borderRadius: 14, padding: 12, flexDirection: "row", gap: 8 }}>
                    <Feather name="alert-triangle" size={13} color={c.status.warning} style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 12, color: c.status.warningDark, flex: 1, lineHeight: 18 }}>
                        {t("Con umbral bajo y registro automático habilitado, hay mayor riesgo de registrar asistencia incorrectamente. Considera subir el umbral a al menos 75%.")}
                    </Text>
                </View>
            )}

            <View style={{ marginTop: 12, backgroundColor: c.brand.primaryLight, borderRadius: 14, padding: 12, flexDirection: "row", gap: 8 }}>
                <Feather name="info" size={13} color={c.brand.primary} style={{ marginTop: 1 }} />
                <Text style={{ fontSize: 12, color: c.brand.primary, flex: 1, lineHeight: 18 }}>
                    {t("Guardar fotos de registro no está disponible por ahora; podría ser una función futura. Hoy solo se almacenan los vectores faciales, nunca las imágenes.")}
                </Text>
            </View>
        </View>
    );
}
