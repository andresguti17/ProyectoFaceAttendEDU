import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

export function ThemePreview({ previewTheme, hasChanges }) {
    const { t } = useTranslation();
    const c = previewTheme.colors;

    return (
        <View style={{
            borderWidth: 1,
            borderColor: c.border.primary,
            borderRadius: 14,
            overflow: "hidden"
        }}>
            {/* Header */}
            <View style={{
                backgroundColor: c.background.surface,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderBottomWidth: 1,
                borderBottomColor: c.border.primary,
            }}>
                <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 14,
                    backgroundColor: c.brand.primary
                }} />
                <Text style={{ fontSize: 12, color: c.font, fontWeight: 400 }}>
                    {t("Asi lucira el aplicativo de forma general con base a los colores que eijas")}
                </Text>
                <View style={{
                    marginLeft: "auto",
                    borderWidth: 2,
                    borderColor: hasChanges ? c.status.warning : c.status.success,
                    borderRadius: 14,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                }}>
                    <Text style={{
                        fontSize: 11,
                        color: hasChanges ? c.status.warning : c.status.success,
                        fontWeight: "700"
                    }}>
                        {hasChanges ? t("SIN GUARDAR") : t("GUARDADO")}
                    </Text>
                </View>
            </View>

            {/* Content */}
            <View style={{
                backgroundColor: c.background.app,
                padding: 14,
                gap: 12
            }}>
                {/* Progress Bar + Badge */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: -8,
                }}>
                    <View style={{
                        flex: 1,
                        height: 5,
                        backgroundColor: c.border.primary,
                        borderRadius: 99
                    }}>
                        <View style={{
                            height: "100%",
                            width: "72%",
                            backgroundColor: c.brand.primary,
                            borderRadius: 99
                        }} />
                    </View>
                    <View style={{
                        backgroundColor: c.brand.primaryLight,
                        borderRadius: 14,
                        paddingHorizontal: 8,
                        paddingVertical: 2
                    }}>
                        <Text style={{
                            fontSize: 11,
                            color: c.brand.primary,
                            fontWeight: "600"
                        }}>
                            72%
                        </Text>
                    </View>
                </View>

                {/* Botones Primarios */}
                <View style={{ flexDirection: "row", gap: 6 }}>
                    <View style={{
                        flex: 1,
                        backgroundColor: c.brand.primary,
                        borderRadius: 14,
                        padding: 10,
                        alignItems: "center"
                    }}>
                        <Text style={{
                            fontSize: 11,
                            color: c.brand.textOnPrimary,
                            fontWeight: "600"
                        }}>
                            {t("Primario")}
                        </Text>
                    </View>
                    <View style={{
                        flex: 1,
                        borderRadius: 14,
                        padding: 10,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: c.brand.primary
                    }}>
                        <Text style={{
                            fontSize: 11,
                            color: c.brand.primary,
                            fontWeight: "600"
                        }}>
                            {t("Outline")}
                        </Text>
                    </View>
                    <View style={{
                        flex: 1,
                        backgroundColor: c.interactive.disabled,
                        borderRadius: 14,
                        padding: 10,
                        alignItems: "center"
                    }}>
                        <Text style={{
                            fontSize: 11,
                            color: c.font,
                            fontWeight: "600"
                        }}>
                            {t("Ghost")}
                        </Text>
                    </View>
                </View>

                {/* Textos sin fondo (solo color de fuente) + Badges con fondo */}
                <View style={{
                    backgroundColor: c.background.surface,
                    borderRadius: 10,
                    marginTop: -10,
                    padding: 10,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
                    {/* Lado izquierdo: textos sin fondo */}
                    <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{
                            fontSize: 12,
                            color: c.font,
                            fontWeight: "500"
                        }}>
                            {t("Texto normal")} (Color de Fuente)
                        </Text>
                        <View style={{
                            flexDirection: "row",
                            gap: 8,
                            flexWrap: "wrap"
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: c.brand.primary,
                                fontWeight: "600"
                            }}>
                                • {t("Primario")}
                            </Text>
                            <Text style={{
                                fontSize: 11,
                                color: c.status.success,
                                fontWeight: "600"
                            }}>
                                • {t("Éxito")}
                            </Text>
                            <Text style={{
                                fontSize: 11,
                                color: c.status.warning,
                                fontWeight: "600"
                            }}>
                                • {t("Advertencia")}
                            </Text>
                            <Text style={{
                                fontSize: 11,
                                color: c.status.error,
                                fontWeight: "600"
                            }}>
                                • {t("Error")}
                            </Text>
                        </View>
                    </View>

                    {/* Lado derecho: badges con fondo */}
                    <View style={{
                        flexDirection: "row",
                        gap: 6,
                        flexWrap: "wrap",
                        justifyContent: "flex-end"
                    }}>
                        <View style={{
                            backgroundColor: c.brand.primaryLight,
                            borderRadius: 14,
                            paddingHorizontal: 8,
                            paddingVertical: 2
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: c.brand.primary,
                                fontWeight: "600"
                            }}>
                                {t("Activo")}
                            </Text>
                        </View>
                        <View style={{
                            backgroundColor: c.status.successLight,
                            borderRadius: 14,
                            paddingHorizontal: 8,
                            paddingVertical: 2
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: c.status.success,
                                fontWeight: "600"
                            }}>
                                {t("Éxito")}
                            </Text>
                        </View>
                        <View style={{
                            backgroundColor: c.status.warningLight,
                            borderRadius: 14,
                            paddingHorizontal: 8,
                            paddingVertical: 2
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: c.status.warning,
                                fontWeight: "600"
                            }}>
                                {t("Advertencia")}
                            </Text>
                        </View>
                        <View style={{
                            backgroundColor: c.status.errorLight,
                            borderRadius: 14,
                            paddingHorizontal: 8,
                            paddingVertical: 2
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: c.status.error,
                                fontWeight: "600"
                            }}>
                                {t("Peligro")}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
