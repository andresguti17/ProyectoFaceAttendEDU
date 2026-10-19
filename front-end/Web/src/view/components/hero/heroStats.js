import React from "react";
import { View, Text } from "react-native";
import { useResponsive } from "../hooks/useResponsive";
import { getTypography } from "../../../core/constants/typography";
import { useTheme } from "../hooks/useTheme";

/**
 * HeroStats - Grid de estadísticas para hero sections
 * 
 * Muestra valores destacados con labels en un layout horizontal.
 * Componente genérico que acepta cualquier conjunto de stats.
 * 
 * @param {Array} stats - Array de estadísticas [{value, label, color?}]
 * @param {number} gap - Espaciado entre stats
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * <HeroStats stats={[
 *   { value: "99%", label: "Precisión", color: theme.colors.status.success },
 *   { value: "<1s", label: "Velocidad" },
 *   { value: "1000+", label: "Usuarios" }
 * ]} />
 */
export default function HeroStats({ stats, gap = 32, style }) {
    const { fs, sp } = useResponsive();
    const { theme } = useTheme();
    const T = getTypography(fs);
    const c = theme.colors;

    return (
        <View style={[{ flexDirection: "row", gap: sp(gap) }, style]}>
            {stats.map((s, idx) => (
                <View key={s.label || `stat-${idx}`}>
                    <Text style={[T.statValue, { color: s.color ?? c.text.primary }]}>
                        {s.value}
                    </Text>
                    <Text style={[T.statLabel, { color: c.text.secondary }]}>
                        {s.label}
                    </Text>
                </View>
            ))}
        </View>
    );
}
