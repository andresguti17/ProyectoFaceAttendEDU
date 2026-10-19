// ============================================================
//  FaceAttend EDU — CameraStep
//  Captura facial con análisis en tiempo real
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";

export default function CameraStep({
    c,
    t,
    camState,
    modelState,
    videoRef,
    workCanvas,
    overlayRef,
    quality,
    stableProgress,
    allQOk,
    onCapture,
    onBack,
}) {
    const criteria = [
        { key: "faceFound", label: t("Rostro detectado"), ok: quality.faceFound },
        { key: "frontal", label: t("De frente"), ok: quality.frontal },
        { key: "pitchOk", label: t("Cabeza nivelada"), ok: quality.pitchOk },
        { key: "eyesOpen", label: t("Ojos abiertos"), ok: quality.eyesOpen },
        { key: "centered", label: t("Rostro centrado"), ok: quality.centered },
        { key: "sizeOk", label: t("Tamaño adecuado"), ok: quality.sizeOk },
        { key: "brightOk", label: t("Iluminación correcta"), ok: quality.brightOk },
    ];

    return (
        <View style={{ padding: 20 }}>
            {/* Cargando modelos */}
            {modelState === "loading" && (
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    padding: 12,
                    borderRadius: 14,
                    marginBottom: 16,
                    backgroundColor: c.brand.primaryLight,
                    borderWidth: 1,
                    borderColor: c.brand.primary,
                }}>
                    <ActivityIndicator size="small" color={c.brand.primary} />
                    <Text style={{ fontSize: 11, color: c.brand.primary, flex: 1 }}>
                        {t("Cargando modelos de reconocimiento facial…")}
                    </Text>
                </View>
            )}

            {modelState === "error" && (
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    padding: 12,
                    borderRadius: 14,
                    marginBottom: 16,
                    backgroundColor: c.status.dangerLight,
                }}>
                    <Feather name="alert-triangle" size={13} color={c.status.danger} />
                    <Text style={{ fontSize: 11, color: c.status.danger, flex: 1 }}>
                        {t("No se pudieron cargar los modelos. Verifica la conexión.")}
                    </Text>
                </View>
            )}

            {/* Visor de cámara — video + canvas overlay superpuesto */}
            <View style={{
                width: "100%",
                aspectRatio: 4 / 3,
                borderRadius: 14,
                overflow: "hidden",
                backgroundColor: "#060a10",
                marginBottom: 16,
                borderWidth: 2,
                borderColor: allQOk
                    ? c.status.success
                    : quality.faceFound
                        ? c.brand.primary
                        : c.border.primary,
                position: "relative",
            }}>
                {Platform.OS === "web" && (
                    <React.Fragment>
                        {/* Video */}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                transform: "scaleX(-1)",
                            }}
                        />
                        {/* Canvas de análisis — oculto */}
                        <canvas ref={workCanvas} style={{ display: "none" }} />
                        {/* Canvas de overlay — visible sobre el video */}
                        <canvas
                            ref={overlayRef}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                pointerEvents: "none",
                            }}
                        />
                    </React.Fragment>
                )}

                {camState === "requesting" && (
                    <View style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                    }}>
                        <ActivityIndicator size="large" color={c.brand.primary} />
                        <Text style={{ fontSize: 11, color: c.text.disabled }}>
                            {t("Solicitando acceso a la cámara…")}
                        </Text>
                    </View>
                )}

                {camState === "denied" && (
                    <View style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        padding: 24,
                    }}>
                        <Feather name="camera-off" size={32} color={c.status.danger} />
                        <Text style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: c.status.danger,
                            textAlign: "center",
                        }}>
                            {t("Permiso de cámara requerido")}
                        </Text>
                        <Text style={{ fontSize: 11, color: c.text.secondary, textAlign: "center" }}>
                            {t("Permite el acceso a la cámara desde la configuración de tu navegador")}
                        </Text>
                    </View>
                )}

                {/* Barra de progreso autocaptura */}
                {camState === "analyzing" && stableProgress > 0 && (
                    <View style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 5,
                        backgroundColor: "rgba(0,0,0,0.3)",
                    }}>
                        <View style={{
                            width: `${stableProgress * 100}%`,
                            height: 5,
                            backgroundColor: c.status.success,
                        }} />
                    </View>
                )}

                {/* Badge de estado */}
                {camState === "analyzing" && (
                    <View style={{
                        position: "absolute",
                        top: 12,
                        alignSelf: "center",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "rgba(0,0,0,0.65)",
                        borderRadius: 14,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                    }}>
                        {allQOk ? (
                            <React.Fragment>
                                <Feather name="check-circle" size={11} color={c.status.success} />
                                <Text style={{ fontSize: 11, color: c.status.success, fontWeight: "600" }}>
                                    {t("Capturando…")}
                                </Text>
                            </React.Fragment>
                        ) : quality.faceFound ? (
                            <React.Fragment>
                                <Feather name="user" size={11} color={c.brand.primary} />
                                <Text style={{ fontSize: 11, color: c.brand.primary, fontWeight: "600" }}>
                                    {t("Rostro detectado")}
                                </Text>
                            </React.Fragment>
                        ) : (
                            <React.Fragment>
                                <Feather name="search" size={11} color={c.text.disabled} />
                                <Text style={{ fontSize: 11, color: c.text.disabled }}>
                                    {t("Buscando rostro…")}
                                </Text>
                            </React.Fragment>
                        )}
                    </View>
                )}
            </View>

            {/* Checklist de criterios */}
            {camState === "analyzing" && (
                <View style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 16,
                }}>
                    {criteria.map((cr) => (
                        <View
                            key={cr.key}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                backgroundColor: cr.ok ? c.status.successLight : c.background.app,
                                borderRadius: 14,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderWidth: 1,
                                borderColor: cr.ok ? c.status.success : c.border.primary,
                            }}
                        >
                            <Feather
                                name={cr.ok ? "check-circle" : "circle"}
                                size={11}
                                color={cr.ok ? c.status.success : c.text.disabled}
                            />
                            <Text style={{
                                fontSize: 10,
                                fontWeight: "600",
                                color: cr.ok ? c.status.success : c.text.disabled,
                            }}>
                                {cr.label}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Botones */}
            <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                    onPress={onBack}
                    style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: c.border.primary,
                        backgroundColor: c.background.app,
                    }}
                >
                    <Feather name="arrow-left" size={14} color={c.text.secondary} />
                    <Text style={{ fontSize: 10, fontWeight: "600", color: c.text.secondary }}>
                        {t("Volver")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onCapture}
                    disabled={camState !== "analyzing"}
                    style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 12,
                        borderRadius: 14,
                        backgroundColor: camState === "analyzing"
                            ? allQOk
                                ? c.status.success
                                : c.brand.primary
                            : c.interactive.disabled,
                    }}
                >
                    <Feather name="camera" size={16} color="#fff" />
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
                        {allQOk ? t("Autocapturando…") : t("Capturar ahora")}
                    </Text>
                </TouchableOpacity>
            </View>

            {!allQOk && camState === "analyzing" && (
                <Text style={{
                    fontSize: 11,
                    color: c.text.disabled,
                    textAlign: "center",
                    marginTop: 8,
                }}>
                    {t("La imagen se captura automáticamente cuando todos los criterios son correctos")}
                </Text>
            )}
        </View>
    );
}

