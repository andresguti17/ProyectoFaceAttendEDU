// ============================================================
//  FaceAttend EDU — FingerprintModule
//
//  Módulo «Registro de huella» (lector DigitalPersona 4500).
//  Captura en el navegador vía el runtime DigitalPersona del equipo
//  local y envía la muestra al API para guardarla o reconocerla.
// ============================================================

import React from "react";
import { Platform, View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, Alert, Badge } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useResponsive } from "../hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { DESIGN_TOKENS } from "../../../core/config/theme.config";
import { useFingerprintReader } from "../../../viewmodels/useFingerprintReader";

function ReaderModule({ vm }) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;
    const fp = useFingerprintReader({ vm });

    const dotColor = fp.readerError ? c.status.error : fp.deviceReady ? c.status.success : c.status.warning;

    return (
        <View style={{ gap: DESIGN_TOKENS.spacing.md }}>
            <View
                accessibilityLiveRegion="polite"
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: DESIGN_TOKENS.spacing.md,
                    borderRadius: DESIGN_TOKENS.borderRadius.md,
                    borderWidth: 1,
                    borderColor: c.border.primary,
                    backgroundColor: c.background.app,
                }}
            >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor }} />
                <Text style={{ flex: 1, color: c.text.primary, fontSize: 14, lineHeight: 20 }}>{fp.readerState}</Text>
                {fp.quality !== null && (
                    <Badge variant={fp.quality >= 60 ? "success" : "warning"} size="sm">
                        {`${t("Calidad")} ${fp.quality}`}
                    </Badge>
                )}
            </View>

            {fp.readerError && (
                <Alert
                    type="warning"
                    title={t("Runtime DigitalPersona no detectado")}
                    message={t(
                        "Instala e inicia el runtime oficial de DigitalPersona en este mismo equipo, además del driver. La web no puede acceder al lector usando solo el driver. Si abres la web desde otro equipo, instala allí también el runtime y conecta allí el lector."
                    )}
                />
            )}

            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 10 }}>
                <Button
                    variant="outline"
                    style={{ flex: 1 }}
                    disabled={fp.readerChecking}
                    loading={fp.readerChecking}
                    leftIcon={<Feather name="search" size={16} color={c.brand.primary} />}
                    onPress={fp.detectReader}
                >
                    {fp.readerChecking ? t("Buscando...") : t("Detectar lector")}
                </Button>
                <Button
                    variant="primary"
                    style={{ flex: 1 }}
                    disabled={vm.busy || fp.capturing || !fp.deviceReady}
                    leftIcon={<Feather name="target" size={16} color={c.brand.textOnPrimary} />}
                    onPress={fp.startCapture}
                >
                    {fp.sampleReady ? t("Capturar otra vez") : t("Iniciar captura")}
                </Button>
                {fp.capturing && (
                    <Button variant="ghost" disabled={vm.busy} onPress={fp.stopCapture}>
                        {t("Detener lector")}
                    </Button>
                )}
            </View>

            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 10 }}>
                <Button
                    variant="primary"
                    style={{ flex: 1 }}
                    disabled={vm.busy || !fp.sampleReady}
                    leftIcon={<Feather name="save" size={16} color={c.brand.textOnPrimary} />}
                    onPress={fp.saveFingerprint}
                >
                    {t("Guardar muestra")}
                </Button>
                <Button
                    variant="outline"
                    style={{ flex: 1 }}
                    disabled={vm.busy || !fp.sampleReady}
                    leftIcon={<Feather name="check-circle" size={16} color={c.brand.primary} />}
                    onPress={fp.loginFingerprint}
                >
                    {t("Reconocer huella")}
                </Button>
            </View>

            <Text style={{ color: c.text.secondary, fontSize: 12, lineHeight: 18 }}>
                {t(
                    "La muestra se captura en memoria del navegador y se envía al servidor; no se guarda en el equipo. El lector debe estar conectado al mismo equipo donde abres esta pantalla."
                )}
            </Text>
        </View>
    );
}

export default function FingerprintModule({ vm }) {
    const { t } = useTranslation();

    if (Platform.OS !== "web") {
        return (
            <Alert
                type="info"
                message={t("El lector de huella DigitalPersona solo está disponible en la versión web.")}
            />
        );
    }
    return <ReaderModule vm={vm} />;
}
