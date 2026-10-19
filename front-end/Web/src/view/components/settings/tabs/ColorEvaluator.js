import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { WcagBadge } from "./WcagBadge";
import { ContrastBar } from "./ContrastBar";

export function ColorEvaluator({ currentHex, verdict }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    // Mapear el scoreColor semántico (string) al color real del tema
    const getScoreColor = (semanticColor) => {
        const colorMap = {
            success: c.status.success,
            warning: c.status.warning,
            error: c.status.error,
        };
        return colorMap[semanticColor] || c.text.secondary;
    };

    const scoreColor = getScoreColor(verdict.scoreColor);

    return (
        <View style={{
            backgroundColor: c.background.app,
            borderRadius: 14,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: c.border.primary,
        }}>
            {/* Header */}
            <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: c.border.primary,
            }}>
                <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 14,
                    backgroundColor: currentHex,
                    borderWidth: 1,
                    borderColor: c.border.secondary,
                }} />
                <View style={{ gap: 4, minWidth: 140 }}>
                    <Text style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: c.text.primary,
                        fontFamily: "monospace"
                    }}>
                        {currentHex.toUpperCase()}
                    </Text>
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6
                    }}>
                        <View style={{
                            width: 8,
                            height: 8,
                            borderRadius: 14,
                            backgroundColor: scoreColor,
                        }} />
                        <Text style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: scoreColor
                        }}>
                            {(() => {
                                const s = t(verdict.score);
                                return s.charAt(0).toUpperCase() + s.slice(1);
                            })()}
                        </Text>
                        <WcagBadge level={verdict.wcagLevel} />
                    </View>
                </View>
                
                {/* Barra de contraste al lado derecho */}
                <View style={{ flex: 1 }}>
                    <ContrastBar ratio={verdict.contrastRatio} />
                </View>
            </View>

            {/* Filas de análisis */}
            {[
                { icon: "eye", label: t("Legibilidad"), value: verdict.readability },
                { icon: "sun", label: t("Sensación"), value: verdict.vibe },
                { icon: "layout", label: t("En la UI"), value: verdict.uiFit },
            ].map((row, i, arr) => (
                <View
                    key={row.label}
                    style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        gap: 10,
                        borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                        borderBottomColor: c.border.primary,
                    }}
                >
                    <Feather
                        name={row.icon}
                        size={13}
                        color={c.text.secondary}
                        style={{ marginTop: 1 }}
                    />
                    <Text style={{
                        fontSize: 12,
                        color: c.text.secondary,
                        width: 72
                    }}>
                        {row.label}
                    </Text>
                    <Text style={{
                        fontSize: 12,
                        color: c.text.primary,
                        flex: 1
                    }}>
                        {row.value}
                    </Text>
                </View>
            ))}

            {/* Consejo */}
            {verdict.tip !== t("Este color funciona bien — no necesita ajustes") ? (
                <View style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: 12,
                    margin: 8,
                    backgroundColor: c.status.warningLight,
                    borderRadius: 14,
                }}>
                    <Feather
                        name="info"
                        size={13}
                        color={c.status.warning}
                        style={{ marginTop: 1 }}
                    />
                    <Text style={{
                        fontSize: 12,
                        color: "#92400E",
                        flex: 1
                    }}>
                        {verdict.tip}
                    </Text>
                </View>
            ) : (
                <View style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: 12,
                    margin: 8,
                    backgroundColor: c.status.successLight,
                    borderRadius: 14,
                }}>
                    <Feather
                        name="check-circle"
                        size={13}
                        color="#059669"
                        style={{ marginTop: 1 }}
                    />
                    <Text style={{
                        fontSize: 12,
                        color: "#065F46",
                        flex: 1
                    }}>
                        {t("Este color funciona bien — no necesita ajustes")}
                    </Text>
                </View>
            )}
        </View>
    );
}
