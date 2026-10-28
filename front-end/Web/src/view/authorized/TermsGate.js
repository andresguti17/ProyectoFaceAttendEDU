// ============================================================
//  FaceAttend EDU — TermsGate
// ============================================================
//  Pantalla bloqueante que AuthMiddleware muestra a un adulto que no ha firmado
//  los términos y condiciones vigentes: el primer ingreso, o cuando cambia la
//  versión. La aceptación se registra una sola vez por versión.
// ============================================================

import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../components/hooks/useTheme";
import { useTranslation } from "../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../context/AuthContext";
import Button from "../components/common/buttons/Button";
import Alert from "../components/common/feedback/Alert";
import { Checkbox } from "../components/common";
import TermsDocument from "../components/privacy/TermsDocument";

export default function TermsGate() {
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const { acceptTerms, logout } = useAuth();
    const [accepted, setAccepted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const submit = async () => {
        if (!accepted || saving) return;
        setSaving(true);
        setError(null);
        const message = await acceptTerms();
        if (message) {
            setError(message);
            setSaving(false);
        }
    };

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: c.background.app }}
            contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }}
        >
            <View style={{
                width: "100%",
                maxWidth: 640,
                backgroundColor: c.background.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border.primary,
                padding: 28,
                gap: 16,
            }}>
                <View style={{ alignItems: "center", gap: 8 }}>
                    <Feather name="file-text" size={40} color={c.brand.primary} />
                    <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: c.text.primary, textAlign: "center" }}>
                        {t("Términos y Condiciones")}
                    </Text>
                    <Text style={{ fontSize: 14, color: c.text.secondary, textAlign: "center", lineHeight: 20 }}>
                        {t("Antes de continuar, lee y firma los términos y condiciones de uso.")}
                    </Text>
                </View>

                <TermsDocument />

                <Checkbox
                    checked={accepted}
                    onToggle={setAccepted}
                    label={t("He leído y acepto los términos y condiciones") + " *"}
                />

                {error ? <Alert type="error" message={error} /> : null}

                <Button variant="primary" onPress={submit} disabled={!accepted || saving}>
                    {saving ? t("Guardando...") : t("Firmar y continuar")}
                </Button>
                <Button variant="ghost" onPress={logout}>
                    {t("Cerrar sesión")}
                </Button>
            </View>
        </ScrollView>
    );
}
