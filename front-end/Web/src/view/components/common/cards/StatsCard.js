// ============================================================
//  FaceAttend EDU — StatsCard (Componente Genérico Reutilizable)
//
//  Tarjeta de estadística con icono, valor y descripción.
//  Reutilizable para cualquier métrica.
//
//  Uso:
//  <StatsCard
//    icon="users"
//    iconColor={theme.colors.brand.primary}
//    iconBgColor={theme.colors.brand.primaryLight}
//    label="Total de usuarios"
//    value={150}
//    description="En el sistema"
//    badge="↗ 12%"
//    badgeColor={theme.colors.status.success}
//  />
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card } from "./Card";
import { useTheme } from "../../hooks/useTheme";
import { useResponsive } from "../../hooks/useResponsive";

/**
 * Tarjeta de estadística reutilizable
 * 
 * @param {string} icon - Nombre del icono de Feather
 * @param {string} iconColor - Color del icono
 * @param {string} iconBgColor - Color de fondo del contenedor del icono
 * @param {string} label - Etiqueta de la estadística
 * @param {number|string} value - Valor de la estadística
 * @param {string} valueColor - Color del valor (opcional)
 * @param {string} description - Descripción adicional (opcional)
 * @param {string} badge - Badge/notificador (ej: "↗ 12%") (opcional)
 * @param {string} badgeColor - Color del badge (opcional)
 * @param {object} style - Estilos adicionales
 */
export function StatsCard({
    icon,
    iconColor,
    iconBgColor,
    label,
    value,
    valueColor,
    description,
    badge,
    badgeColor,
    style,
}) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const c = theme.colors;

    return (
        <Card padding={16} style={[{ flex: 1 }, style]}>
            {/* Header: Ícono + Label con Badge */}
            <View style={{ 
                flexDirection: "row", 
                alignItems: "center", 
                justifyContent: "space-between",
                marginBottom: 12,
            }}>
                {/* Ícono + Label en fila */}
                <View style={{ 
                    flexDirection: "row", 
                    alignItems: "center", 
                    gap: 8,
                    flex: 1,
                }}>
                    {icon && (
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: iconBgColor || c.brand.primaryLight,
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <Feather
                                name={icon}
                                size={20}
                                color={iconColor || c.brand.primary}
                            />
                        </View>
                    )}
                    <Text style={{ 
                        fontSize: 13, 
                        color: c.text.secondary,
                        fontWeight: "500",
                        flex: 1,
                    }}>
                        {label}
                    </Text>
                </View>
                
                {/* Badge/Notificador al lado derecho */}
                {badge && (
                    <Text style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: badgeColor || c.status.success,
                    }}>
                        {badge}
                    </Text>
                )}
            </View>

            {/* Valor principal */}
            <Text style={{
                fontSize: 28,
                fontWeight: "700",
                color: valueColor || c.text.primary,
                marginBottom: description ? 4 : 0,
            }}>
                {value}
            </Text>
            
            {/* Descripción adicional */}
            {description && (
                <Text style={{ 
                    fontSize: 11, 
                    color: c.text.secondary,
                }}>
                    {description}
                </Text>
            )}
        </Card>
    );
}

export default StatsCard;
