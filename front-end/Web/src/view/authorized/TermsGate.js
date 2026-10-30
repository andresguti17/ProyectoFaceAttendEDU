// ============================================================
//  FaceAttend EDU — TermsGate
// ============================================================
//  Aviso bloqueante que AuthMiddleware muestra a un adulto que no ha firmado
//  los términos y condiciones vigentes: el primer ingreso, o cuando cambia la
//  versión. Replica el modal de la app móvil (TerminosModal): título, texto
//  con scroll, "Firmar y continuar" y "Salir sin firmar", que cierra la sesión.
//  La aceptación se registra una sola vez por versión en identity.
// ============================================================

import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTheme } from "../components/hooks/useTheme";
import { useTranslation } from "../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../context/AuthContext";
import Button from "../components/common/buttons/Button";
import Alert from "../components/common/feedback/Alert";
import TermsDocument from "../components/privacy/TermsDocument";

export default function TermsGate() {
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const { acceptTerms, logout } = useAuth();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const submit = async () => {
        if (saving) return;
        setSaving(true);
        setError(null);
        const message = await acceptTerms();
        if (message) {
            setError(t(message));
            setSaving(false);
        }
    };

    return (
        <View
            accessibilityViewIsModal
            style={{
                flex: 1,
                backgroundColor: c.background.overlay,
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            <View
                accessibilityRole="alert"
                style={{
                    width: "100%",
                    maxWidth: 640,
                    maxHeight: "92%",
                    backgroundColor: c.background.surface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: c.border.primary,
                    padding: 24,
                    gap: 16,
                }}
            >
                <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: c.text.primary, textAlign: "center" }}>
                    {t("Términos y Condiciones")}
                </Text>

                <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingRight: 4 }}>
                    <TermsDocument />
                </ScrollView>

                {error ? <Alert type="error" message={error} /> : null}

                <Button variant="primary" onPress={submit} disabled={saving}>
                    {saving ? t("Firmando...") : t("Firmar y continuar")}
                </Button>
                <Button variant="ghost" onPress={logout} disabled={saving}>
                    {t("Salir sin firmar")}
                </Button>
            </View>
        </View>
    );
}
