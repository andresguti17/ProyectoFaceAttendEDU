// ============================================================
//  PasswordPolicyModal - Modal con recordatorio de políticas de contraseña
// ============================================================

import React from "react";
import { TouchableOpacity, View, Text, Modal, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";

export function PasswordPolicyModal({ visible, onClose, onResetPassword }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const requirements = [
        { iconText: "A-Z", label: t("Mayúsculas"), fontSize: 11 },
        { iconText: "a-z", label: t("Minúsculas") },
        { iconText: "0-9", label: t("Números") , fontSize: 12 },
        { iconText: "$", label: t("Carácteres especiales") },
        { iconText: "+8", label: t("Y como mínimo 8 caracteres"), fontSize: 12 },
    ];

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 20,
                }}
                activeOpacity={1}
                onPress={onClose}
            >
                <View
                    style={{
                        backgroundColor: c.background.surface,
                        borderRadius: 16,
                        padding: 24,
                        minWidth: 320,
                        maxWidth: 420,
                        borderWidth: 1,
                        borderColor: c.border.primary,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        elevation: 15,
                    }}
                    onStartShouldSetResponder={() => true}
                >
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 16,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: c.brand.primaryLight,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Feather name="alert-circle" size={25} color={c.brand.primary} />
                            </View>
                            <Text
                                style={{
                                    fontSize: 18,
                                    fontWeight: "700",
                                    color: c.text.primary,
                                }}
                            >
                                {t("¿No recuerdas tu contraseña?")}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{
                                padding: 4,
                            }}
                        >
                            <Feather name="x" size={20} color={c.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Subtítulo */}
                    <Text
                        style={{
                            fontSize: 14,
                            color: c.text.secondary,
                            marginBottom: 16,
                        }}
                    >
                        {t("Tranquilo, recuerda que puede tener:")}
                    </Text>

                    {/* Lista de requisitos - compacta */}
                    <View style={{ gap: 10, marginBottom: 20 }}>
                        {requirements.map((req, index) => (
                            <View
                                key={index}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 12,
                                }}
                            >
                                <View
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        backgroundColor: c.status.successLight,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: req.fontSize || 14,
                                            fontWeight: "700",
                                            color: c.status.success,
                                        }}
                                    >
                                        {req.iconText}
                                    </Text>
                                </View>
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: c.text.primary,
                                        flex: 1,
                                    }}
                                >
                                    {req.label}
                                </Text>
                                <Feather
                                    name="check"
                                    size={14}
                                    color={c.status.success}
                                />
                            </View>
                        ))}
                    </View>

                    {/* Separador */}
                    <View
                        style={{
                            height: 1,
                            backgroundColor: c.border.primary,
                            marginBottom: 16,
                        }}
                    />

                    {/* Footer - Restablecer */}
                    <View style={{ alignItems: "center", gap: 10 }}>
                        <Text
                            style={{
                                fontSize: 13,
                                color: c.text.secondary,
                                textAlign: "center",
                            }}
                        >
                            {t("¿Definitivamente no la recuerdas?")}
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                onClose();
                                onResetPassword();
                            }}
                            style={{
                                backgroundColor: c.brand.primary,
                                paddingVertical: 10,
                                paddingHorizontal: 20,
                                borderRadius: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                            }}
                            activeOpacity={0.8}
                        >
                            <Feather name="refresh-cw" size={16} color={c.brand.textOnPrimary} />
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: c.brand.textOnPrimary,
                                }}
                            >
                                {t("Restablécela ahora")}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}
