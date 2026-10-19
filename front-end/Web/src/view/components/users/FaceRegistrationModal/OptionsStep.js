// ============================================================
//  FaceAttend EDU — OptionsStep
//  Pantalla inicial del modal de registro facial
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";

export default function OptionsStep({ c, t, onCamera, onFileLoad, loadError }) {
    return (
        <ScrollView style={{ padding: 24 }}>
            <View style={{
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
            }}>
                <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 14,
                    backgroundColor: c.brand.primaryLight,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                }}>
                    <Feather name="user-check" size={32} color={c.brand.primary} />
                </View>

                <Text style={{
                    fontSize: 10,
                    fontWeight: "600",
                    color: c.text.primary,
                    textAlign: "center",
                    marginBottom: 4,
                }}>
                    {t("¿Cómo deseas registrar el rostro?")}
                </Text>
                <Text style={{
                    fontSize: 11,
                    color: c.text.secondary,
                    textAlign: "center",
                    marginBottom: 20,
                }}>
                    {t("Captura en vivo o carga un archivo de descriptor existente")}
                </Text>

                <TouchableOpacity
                    onPress={onCamera}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        padding: 16,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: c.brand.primary,
                        backgroundColor: c.brand.primaryLight,
                        marginBottom: 16,
                        width: "100%",
                    }}
                >
                    <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        backgroundColor: c.brand.primary,
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                        <Feather name="camera" size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: c.brand.primary,
                        }}>
                            {t("Capturar con cámara")}
                        </Text>
                        <Text style={{
                            fontSize: 11,
                            color: c.text.secondary,
                            marginTop: 2,
                        }}>
                            {t("Usa la cámara del dispositivo para capturar el rostro en tiempo real")}
                        </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={c.brand.primary} />
                </TouchableOpacity>

                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                    width: "100%",
                }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: c.border.primary }} />
                    <Text style={{ fontSize: 11, color: c.text.disabled }}>
                        {t("o también")}
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: c.border.primary }} />
                </View>

                <TouchableOpacity
                    onPress={onFileLoad}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        padding: 16,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: c.border.primary,
                        backgroundColor: c.background.app,
                        width: "100%",
                    }}
                >
                    <Feather name="upload" size={16} color={c.text.secondary} />
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: c.text.secondary,
                        }}>
                            {t("Cargar descriptor facial (.json)")}
                        </Text>
                        <Text style={{
                            fontSize: 11,
                            color: c.text.disabled,
                            marginTop: 1,
                        }}>
                            {t("Si ya tienes el archivo generado previamente")}
                        </Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={c.text.disabled} />
                </TouchableOpacity>

                {loadError && (
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 16,
                        padding: 12,
                        borderRadius: 14,
                        backgroundColor: c.status.dangerLight,
                        width: "100%",
                    }}>
                        <Feather name="alert-circle" size={13} color={c.status.danger} />
                        <Text style={{
                            fontSize: 11,
                            color: c.status.danger,
                            flex: 1,
                        }}>
                            {loadError}
                        </Text>
                    </View>
                )}

                <View style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: c.background.app,
                    borderWidth: 1,
                    borderColor: c.border.primary,
                    width: "100%",
                }}>
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                    }}>
                        <Feather name="info" size={12} color={c.text.secondary} />
                        <Text style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: c.text.secondary,
                        }}>
                            {t("Formato de archivo")}
                        </Text>
                    </View>
                    <Text style={{
                        fontSize: 11,
                        color: c.text.disabled,
                        lineHeight: 16,
                    }}>
                        {t("El archivo .json debe tener el esquema faceattend-v1: descriptor de 128 valores float normalizados (compatible con face-api.js y face_recognition de Python).")}
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

