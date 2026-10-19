// ============================================================
//  FaceAttend EDU — ConfirmStep
//  Confirmación de captura facial
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";

export default function ConfirmStep({ c, t, capturedUrl, processing, onRetake, onConfirm }) {
    return (
        <View style={{ padding: 24 }}>
            <Text style={{
                fontSize: 10,
                fontWeight: "600",
                color: c.text.primary,
                textAlign: "center",
                marginBottom: 12,
            }}>
                {t("¿Se ve bien el rostro?")}
            </Text>

            {/* Foto capturada real */}
            <View style={{
                width: "100%",
                aspectRatio: 4 / 3,
                borderRadius: 14,
                overflow: "hidden",
                marginBottom: 16,
                borderWidth: 2,
                borderColor: c.status.success,
                backgroundColor: "transparent",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
            }}>
                {capturedUrl && Platform.OS === "web" && (
                    <img
                        src={capturedUrl}
                        alt="Captured face"
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                )}
                <View style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "rgba(16,185,129,0.2)",
                    borderRadius: 14,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: c.status.success,
                }}>
                    <Feather name="check" size={10} color={c.status.success} />
                    <Text style={{ fontSize: 11, color: c.status.success, fontWeight: "700" }}>
                        OK
                    </Text>
                </View>
            </View>

            <Text style={{
                fontSize: 11,
                color: c.text.secondary,
                textAlign: "center",
                marginBottom: 16,
            }}>
                {t("Al confirmar se generará el descriptor facial para el backend")}
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                    onPress={onRetake}
                    disabled={processing}
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
                    <Feather name="refresh-cw" size={14} color={c.text.secondary} />
                    <Text style={{ fontSize: 10, fontWeight: "600", color: c.text.secondary }}>
                        {t("Repetir")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onConfirm}
                    disabled={processing}
                    style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 12,
                        borderRadius: 14,
                        backgroundColor: processing ? c.interactive.disabled : c.brand.primary,
                    }}
                >
                    {processing ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Feather name="cpu" size={15} color="#fff" />
                    )}
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
                        {processing ? t("Procesando rostro…") : t("Confirmar y generar")}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

