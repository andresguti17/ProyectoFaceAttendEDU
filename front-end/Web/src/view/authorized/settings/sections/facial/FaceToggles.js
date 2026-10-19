// ============================================================
//  FaceToggles — Toggles de registro automático y fotos
//  UI pura. Sin estado propio.
//
//  Props:
//   - confidence    : number — para la advertencia combinada
//   - autoRegister  : bool
//   - onAutoRegister: () => void
//   - savePhotos    : bool
//   - onSavePhotos  : () => void
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ToggleRow } from "../../../../components/common";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function FaceToggles({ confidence, autoRegister, onAutoRegister, savePhotos, onSavePhotos }) {
    const { t } = useTranslation();
    const { c } = useSettingsSectionStyles();

    return (
        <View style={{ gap: 0 }}>
            <ToggleRow
                label={t("Registro automático")}
                description={t("Registra automáticamente al detectar el rostro sin confirmación manual")}
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

            <ToggleRow
                label={t("Guardar fotos de registro")}
                description={t("Almacena la foto tomada al registrar. Útil para auditorías pero consume más espacio.")}
                value={savePhotos}
                onToggle={onSavePhotos}
            />

            {savePhotos && (
                <View style={{ marginTop: 8, backgroundColor: c.brand.primaryLight, borderRadius: 14, padding: 12, flexDirection: "row", gap: 8 }}>
                    <Feather name="info" size={13} color={c.brand.primary} style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 12, color: c.brand.primary, flex: 1, lineHeight: 18 }}>
                        {t("Las fotos se almacenan localmente. Asegúrate de tener suficiente espacio y de informar a los estudiantes según tu política de privacidad.")}
                    </Text>
                </View>
            )}
        </View>
    );
}
