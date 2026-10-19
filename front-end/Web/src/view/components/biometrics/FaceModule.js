// ============================================================
//  FaceAttend EDU — FaceModule
//
//  Módulos «Registro facial» y «Reconocimiento facial».
//  Misma cámara y mismo visor para ambos (mode = "register" | "login"),
//  así al cambiar de pestaña no se vuelve a pedir permiso de cámara.
//  El <video> es un elemento DOM (react-native-web corre sobre react-dom).
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, Alert, ProgressBar } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useResponsive } from "../hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { DESIGN_TOKENS } from "../../../core/config/theme.config";
import { useFaceCapture, CAMERA_SUPPORTED } from "../../../viewmodels/useFaceCapture";

const CORNER = 24;

function Corner({ position, color }) {
    const base = { position: "absolute", width: CORNER, height: CORNER, borderColor: color };
    const spots = {
        tl: { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2 },
        tr: { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2 },
        bl: { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2 },
        br: { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2 },
    };
    return <View pointerEvents="none" style={[base, spots[position]]} />;
}

function Viewfinder({ videoRef, cameraReady, busy, onStart, tag }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    return (
        <View
            style={{
                width: "100%",
                aspectRatio: 16 / 10,
                borderRadius: DESIGN_TOKENS.borderRadius.lg,
                overflow: "hidden",
                backgroundColor: "#000",
                borderWidth: 1,
                borderColor: c.border.primary,
            }}
        >
            {/* Espejo horizontal: el usuario se ve como en un espejo. */}
            {React.createElement("video", {
                ref: videoRef,
                autoPlay: true,
                playsInline: true,
                muted: true,
                style: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    transform: "scaleX(-1)",
                },
            })}

            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    left: "27%",
                    top: "12%",
                    width: "46%",
                    height: "76%",
                    borderRadius: 9999,
                    borderWidth: 2,
                    borderStyle: "dashed",
                    borderColor: c.brand.primary,
                    opacity: 0.7,
                }}
            />
            <Corner position="tl" color={c.brand.primary} />
            <Corner position="tr" color={c.brand.primary} />
            <Corner position="bl" color={c.brand.primary} />
            <Corner position="br" color={c.brand.primary} />

            <View
                pointerEvents="none"
                style={{ position: "absolute", bottom: 12, left: 0, right: 0, alignItems: "center" }}
            >
                <View
                    style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 9999,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        borderWidth: 1,
                        borderColor: c.brand.primary,
                    }}
                >
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{tag}</Text>
                </View>
            </View>

            {!cameraReady && (
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        padding: DESIGN_TOKENS.spacing.lg,
                        backgroundColor: "rgba(0,0,0,0.78)",
                    }}
                >
                    <Feather name="camera" size={32} color={c.brand.primary} />
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{t("Acceso a la cámara")}</Text>
                    <Text style={{ color: "#CBD5E1", fontSize: 13, textAlign: "center", maxWidth: 320 }}>
                        {t("El navegador te preguntará si permites usarla.")}
                    </Text>
                    <Button variant="primary" size="sm" disabled={busy} onPress={onStart}>
                        {t("Dar acceso a la cámara")}
                    </Button>
                </View>
            )}
        </View>
    );
}

export default function FaceModule({ vm, mode }) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;
    const face = useFaceCapture({ vm });
    const isRegister = mode === "register";

    if (!CAMERA_SUPPORTED) {
        return (
            <Alert
                type="warning"
                title={t("Cámara no disponible")}
                message={t(
                    "Este navegador no permite acceder a la cámara. Usa un navegador moderno y, si accedes desde otro equipo, abre FaceAttend EDU por HTTPS."
                )}
            />
        );
    }

    const progress = face.livenessProgress;
    const tag = progress
        ? `${t("Gesto")} ${Math.min(progress.done + 1, progress.total)} ${t("de")} ${progress.total}`
        : isRegister
          ? t("REGISTRO FACIAL")
          : t("RECONOCIMIENTO FACIAL");

    return (
        <View style={{ gap: DESIGN_TOKENS.spacing.md }}>
            <Viewfinder
                videoRef={face.videoRef}
                cameraReady={face.cameraReady}
                busy={vm.busy}
                onStart={face.startCamera}
                tag={tag}
            />

            {progress && (
                <View style={{ gap: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
                        {Array.from({ length: progress.total }, (_, index) => (
                            <View
                                key={index}
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 5,
                                    backgroundColor: index < progress.done ? c.brand.primary : c.border.secondary,
                                }}
                            />
                        ))}
                    </View>
                    <ProgressBar value={(progress.done / progress.total) * 100} variant="primary" size="sm" animated />
                </View>
            )}

            {!!face.livenessAction && (
                <View
                    accessibilityRole="alert"
                    style={{
                        padding: DESIGN_TOKENS.spacing.md,
                        borderRadius: DESIGN_TOKENS.borderRadius.md,
                        backgroundColor: c.brand.primaryLight,
                        borderWidth: 2,
                        borderColor: c.brand.primary,
                    }}
                >
                    <Text style={{ color: c.text.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                        {t("INSTRUCCIÓN ACTUAL")}
                    </Text>
                    <Text style={{ color: c.text.primary, fontSize: isSmall ? 18 : 22, fontWeight: "700", marginTop: 4 }}>
                        {face.livenessAction}
                    </Text>
                </View>
            )}

            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 10 }}>
                <Button
                    variant="primary"
                    style={{ flex: 1 }}
                    disabled={!face.cameraReady || vm.busy}
                    loading={vm.busy}
                    leftIcon={<Feather name={isRegister ? "user-plus" : "user-check"} size={16} color={c.brand.textOnPrimary} />}
                    onPress={isRegister ? face.registerFace : face.loginFace}
                >
                    {isRegister ? t("Registrar rostro (3 gestos)") : t("Reconocer rostro (2 gestos)")}
                </Button>
                {face.cameraReady && (
                    <Button variant="outline" disabled={vm.busy} onPress={face.stopCamera}>
                        {t("Apagar cámara")}
                    </Button>
                )}
            </View>

            <Text style={{ color: c.text.secondary, fontSize: 12, lineHeight: 18 }}>
                {isRegister
                    ? t(
                          "Prueba de vida activa: se te pedirán 3 gestos aleatorios (parpadear, girar la cabeza, abrir la boca). Si el usuario ya existe, su rostro se actualiza."
                      )
                    : t(
                          "Prueba de vida activa: se te pedirán 2 gestos aleatorios y el rostro se comparará con todas las personas registradas."
                      )}
            </Text>
        </View>
    );
}
