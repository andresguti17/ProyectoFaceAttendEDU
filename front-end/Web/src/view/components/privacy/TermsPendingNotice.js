// ============================================================
//  FaceAttend EDU — TermsPendingNotice
//  Se muestra en lugar de la cámara/lector mientras identity no dé a la persona por
//  habilitada (términos sin aceptar, acudiente o autorización del acudiente pendientes).
//  ms-biometric rechazaría la captura con 403; aquí se explica el paso que falta y quién
//  debe darlo. Un adulto firma sus propios términos: el administrador no puede hacerlo por él.
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { Button } from "../common";

export default function TermsPendingNotice({ personName, pending, onRetry, busy = false }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const name = personName || t("La persona");

    let title = t("Faltan los términos y condiciones");
    let body = `${name} ${t("debe iniciar sesión con su propia cuenta y aceptar los términos y condiciones. Un adulto los acepta personalmente; un administrador no puede hacerlo por él. Después podrás registrar su biometría.")}`;
    if (pending?.step === "GUARDIAN") {
        title = t("Falta registrar al acudiente");
        body = t("Registra al acudiente del menor desde el detalle del estudiante antes de capturar su biometría.");
    } else if (pending?.step === "DOCUMENT") {
        title = t("Falta la autorización firmada del acudiente");
        body = t("Carga la autorización firmada del acudiente desde el detalle del estudiante antes de capturar su biometría.");
    } else if (pending?.minor) {
        body = t("Los términos de un menor los registra el administrador de la sede con el acudiente presente, desde el detalle del estudiante.");
    }

    return (
        <View
            accessibilityLabel={t("Registro previo pendiente")}
            style={{ gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: c.status.warning }}
        >
            <Text accessibilityRole="header" style={{ fontWeight: "700", fontSize: 15, color: c.text.primary }}>
                {title}
            </Text>
            <Text style={{ fontSize: 13, color: c.text.secondary }}>{body}</Text>
            {onRetry && (
                <Button variant="secondary" onPress={onRetry} disabled={busy}>
                    {t("Verificar de nuevo")}
                </Button>
            )}
        </View>
    );
}
