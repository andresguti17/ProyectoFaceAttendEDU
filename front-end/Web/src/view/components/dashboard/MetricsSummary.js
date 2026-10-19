// ============================================================
//  MetricsSummary — Resumen de métricas clave del dashboard
// ============================================================
//  Componente genérico que muestra un resumen compacto de
//  métricas principales con indicadores visuales
//
//  Adaptable por rol (Admin/Teacher/Student)
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card } from "../common";
import { useTheme } from "../hooks/useTheme";

/**
 * Resumen visual de métricas clave
 * 
 * @param {Array} metrics - Métricas a mostrar: [{ label, value, color, icon, trend }]
 * @param {string} title - Título del resumen (opcional)
 * @param {boolean} compact - Modo compacto (default: false)
 */
export function MetricsSummary({ 
    metrics = [], 
    title = null,
    compact = false,
}) {
    const { theme } = useTheme();
    const c = theme.colors;

    if (!metrics || metrics.length === 0) return null;

    return (
        <Card style={{ padding: compact ? 12 : 16 }}>
            {title && (
                <Text style={{
                    fontSize: compact ? 13 : 14,
                    fontWeight: "600",
                    color: c.text.primary,
                    marginBottom: 12,
                }}>
                    {title}
                </Text>
            )}

            <View style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: compact ? 12 : 16,
                justifyContent: "space-around",
            }}>
                {metrics.map((metric, index) => (
                    <View
                        key={`${metric.label}-${index}`}
                        style={{
                            alignItems: "center",
                            minWidth: compact ? 70 : 80,
                        }}
                    >
                        {/* Icono */}
                        {metric.icon && (
                            <View style={{
                                width: compact ? 32 : 36,
                                height: compact ? 32 : 36,
                                borderRadius: compact ? 16 : 18,
                                backgroundColor: `${metric.color}15`,
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 6,
                            }}>
                                <Feather 
                                    name={metric.icon} 
                                    size={compact ? 14 : 16} 
                                    color={metric.color} 
                                />
                            </View>
                        )}

                        {/* Valor */}
                        <Text style={{
                            fontSize: compact ? 16 : 18,
                            fontWeight: "700",
                            color: metric.color || c.text.primary,
                            marginBottom: 2,
                        }}>
                            {metric.value}
                        </Text>

                        {/* Label */}
                        <Text style={{
                            fontSize: compact ? 10 : 11,
                            color: c.text.secondary,
                            textAlign: "center",
                        }}>
                            {metric.label}
                        </Text>

                        {/* Tendencia (opcional) */}
                        {metric.trend && (
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginTop: 4,
                                gap: 3,
                            }}>
                                <Feather
                                    name={metric.trend === "up" ? "trending-up" : "trending-down"}
                                    size={10}
                                    color={metric.trend === "up" ? c.status.success : c.status.danger}
                                />
                                <Text style={{
                                    fontSize: 9,
                                    fontWeight: "600",
                                    color: metric.trend === "up" ? c.status.success : c.status.danger,
                                }}>
                                    {metric.trendValue}
                                </Text>
                            </View>
                        )}
                    </View>
                ))}
            </View>
        </Card>
    );
}

export default MetricsSummary;
