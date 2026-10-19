// ============================================================
//  TopPerformingGroups — Ranking de fichas/grupos
// ============================================================
//  Muestra las fichas con mejor y peor asistencia
//  Permite visualizar el rendimiento de cada grupo
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card, Badge, ProgressBar } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { getContrastTextColor } from "../../../core/utils/colorHelpers";
import { useAttendanceColor } from "../common/badges/StatusBadge";

/**
 * Componente interno para renderizar cada ficha con color dinámico
 */
function FichaRow({ ficha, index, mode, totalFichas, isLast, onPress, c, t }) {
    // Color dinámico basado en asistencia
    const barColor = useAttendanceColor(ficha.avgAttendance);
    
    // Icono de medalla para top 3
    const medal = mode === "top" && index < 3 ? ["🥇", "🥈", "🥉"][index] : null;
    
    // Ranking number
    const ranking = mode === "top" ? index + 1 : totalFichas - (totalFichas - index);

    return (
        <TouchableOpacity
            onPress={() => onPress?.(ficha)}
            style={{
                padding: 16,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: c.border.primary,
            }}
        >
            {/* Header con ranking */}
            <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
            }}>
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                }}>
                    {/* Ranking número o medalla */}
                    {medal ? (
                        <Text style={{ fontSize: 24 }}>{medal}</Text>
                    ) : (
                        <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: c.background.app,
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: "700",
                                color: c.text.secondary,
                            }}>
                                {ranking}
                            </Text>
                        </View>
                    )}

                    {/* Código de ficha con color dinámico */}
                    <View style={{ flex: 1 }}>
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                        }}>
                            {/* Badge con color del curso */}
                            <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                backgroundColor: ficha.color || c.brand.primary,
                            }}>
                                <Text style={{
                                    fontSize: 12,
                                    fontWeight: "600",
                                    color: getContrastTextColor(ficha.color || c.brand.primary),
                                }}>
                                    {ficha.code}
                                </Text>
                            </View>
                            <Text style={{
                                fontSize: 12,
                                color: c.text.secondary,
                            }} numberOfLines={1}>
                                {ficha.program}
                            </Text>
                        </View>
                        
                        <Text style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: c.text.primary,
                            marginTop: 4,
                        }} numberOfLines={1}>
                            {ficha.name}
                        </Text>
                    </View>
                </View>

                {/* Porcentaje con color dinámico */}
                <Text style={{
                    fontSize: 20,
                    fontWeight: "800",
                    color: barColor,
                    marginLeft: 8,
                }}>
                    {ficha.avgAttendance.toFixed(1)}%
                </Text>
            </View>

            {/* Barra de progreso con color dinámico */}
            <ProgressBar
                value={ficha.avgAttendance}
                color={barColor}
                size="md"
            />

            {/* Información adicional */}
            <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 8,
            }}>
                <Text style={{
                    fontSize: 11,
                    color: c.text.secondary,
                }}>
                    <Feather name="user" size={11} /> {ficha.instructor}
                </Text>

                <View style={{
                    flexDirection: "row",
                    gap: 12,
                }}>
                    <Text style={{
                        fontSize: 11,
                        color: c.text.secondary,
                    }}>
                        {ficha.activeStudents}/{ficha.totalStudents} {t("activos")}
                    </Text>

                    {ficha.atRiskStudents > 0 && (
                        <Text style={{
                            fontSize: 11,
                            color: c.status.danger,
                            fontWeight: "600",
                        }}>
                            ⚠ {ficha.atRiskStudents} {t("en riesgo")}
                        </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

/**
 * Ranking de fichas por desempeño con colores dinámicos
 * 
 * @param {Array} fichas - Array de fichas/grupos
 * @param {string} mode - Modo: 'top' (mejores) o 'bottom' (peores)
 * @param {number} maxItems - Número máximo de items (default: 5)
 * @param {function} onFichaPress - Callback al presionar una ficha
 */
export function TopPerformingGroups({
    fichas = [],
    mode = "top", // 'top' | 'bottom'
    maxItems = 5,
    onFichaPress,
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    // Ordenar fichas según el modo
    const sortedFichas = [...fichas].sort((a, b) => {
        return mode === "top" 
            ? b.avgAttendance - a.avgAttendance 
            : a.avgAttendance - b.avgAttendance;
    });

    const displayedFichas = sortedFichas.slice(0, maxItems);

    if (fichas.length === 0) {
        return (
            <Card>
                <View style={{ padding: 16, alignItems: "center" }}>
                    <Feather name="users" size={32} color={c.text.secondary} />
                    <Text style={{
                        fontSize: 14,
                        color: c.text.secondary,
                        marginTop: 8,
                    }}>
                        {t("No hay datos de fichas")}
                    </Text>
                </View>
            </Card>
        );
    }

    return (
        <Card padding={0}>
            {displayedFichas.map((ficha, index) => (
                <FichaRow
                    key={ficha.id}
                    ficha={ficha}
                    index={index}
                    mode={mode}
                    totalFichas={fichas.length}
                    isLast={index === displayedFichas.length - 1}
                    onPress={onFichaPress}
                    c={c}
                    t={t}
                />
            ))}
        </Card>
    );
}

export default TopPerformingGroups;
