// ============================================================
//  FaceAttend EDU — MinorBlockedGate
// ============================================================
//  Bloqueo visible para un menor de edad cuyo registro no está completo. El menor
//  no puede completarlo desde la aplicación: el acudiente debe acudir presencialmente
//  a la sede, donde el administrador lo registra, registra la aceptación de los
//  términos y captura los parámetros faciales. La pantalla indica el paso pendiente.
// ============================================================

import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../components/hooks/useTheme";
import { useTranslation } from "../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../context/AuthContext";
import Button from "../components/common/buttons/Button";
import Alert from "../components/common/feedback/Alert";

export default function MinorBlockedGate() {
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const { user, refreshTerms, logout } = useAuth();
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState(null);

    const guardianPending = user?.termsStep === "GUARDIAN";

    const recheck = async () => {
        setChecking(true);
        setError(null);
        const message = await refreshTerms();
        if (message) setError(message);
        setChecking(false);
    };

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: c.background.app }}
            contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }}
        >
            <View style={{
                width: "100%",
                maxWidth: 560,
                backgroundColor: c.background.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border.primary,
                padding: 28,
                gap: 16,
            }}>
                <View style={{ alignItems: "center", gap: 8 }}>
                    <Feather name="lock" size={40} color={c.status.warning} />
                    <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: c.text.primary, textAlign: "center" }}>
                        {t("Registro pendiente")}
                    </Text>
                    <Text style={{ fontSize: 14, color: c.text.secondary, textAlign: "center", lineHeight: 20 }}>
                        {t("Eres menor de edad: el registro lo completa tu acudiente en la sede del SENA con el administrador.")}
                    </Text>
                </View>

                <Alert
                    type="warning"
                    message={guardianPending
                        ? t("Paso pendiente: registrar a tu acudiente. Debe acudir a la sede con su documento de identidad.")
                        : t("Paso pendiente: que tu acudiente acepte los términos y condiciones en la sede.")}
                />

                <Text style={{ fontSize: 13, color: c.text.secondary, lineHeight: 19 }}>
                    {t("Mientras el registro no esté completo no puedes usar las funciones que requieren términos aceptados ni la verificación facial.")}
                </Text>

                {error ? <Alert type="error" message={error} /> : null}

                <Button variant="primary" onPress={recheck} disabled={checking}>
                    {checking ? t("Verificando...") : t("Ya completamos el registro, verificar")}
                </Button>
                <Button variant="ghost" onPress={logout}>
                    {t("Cerrar sesión")}
                </Button>
            </View>
        </ScrollView>
    );
}
