// ============================================================
//  FaceAttend EDU — BiometricConsentPrompt
//  Se muestra en lugar de la cámara/lector mientras la persona no haya
//  autorizado el tratamiento de sus datos biométricos (Ley 1581, arts. 6-a y 9).
//  Si quien opera es otra persona (admin), confirma que el titular, presente,
//  lo autorizó: identity lo guarda como aceptación asistida.
// ============================================================

import React, { useState } from "react";
import { View, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { Button, Checkbox } from "../common";
import PrivacyNotice from "./PrivacyNotice";

export default function BiometricConsentPrompt({ personName, onAuthorize, busy = false }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const [confirmed, setConfirmed] = useState(false);

    return (
        <View
            accessibilityLabel={t("Autorización de datos biométricos")}
            style={{ gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: c.status.warning }}
        >
            <Text accessibilityRole="header" style={{ fontWeight: "700", fontSize: 15, color: c.text.primary }}>
                {t("Falta la autorización de datos biométricos")}
            </Text>
            <PrivacyNotice compact />
            <Checkbox
                checked={confirmed}
                onToggle={setConfirmed}
                label={`${personName || t("La persona")} ${t("autoriza de forma previa, expresa e informada el tratamiento de sus datos biométricos")}`}
            />
            <Button variant="primary" onPress={onAuthorize} disabled={!confirmed || busy}>
                {t("Registrar autorización")}
            </Button>
        </View>
    );
}
