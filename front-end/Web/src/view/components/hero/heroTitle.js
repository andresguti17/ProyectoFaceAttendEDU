import React from "react";
import { Text } from "react-native";
import { useResponsive } from "../hooks/useResponsive";
import { getTypography } from "../../../core/constants/typography";
import { useTheme } from "../hooks/useTheme";

/**
 * HeroTitle - Título destacado con texto de acento
 * 
 * Muestra un título grande con una parte destacada en color de acento.
 * Ideal para hero sections y páginas de landing.
 * 
 * @param {string} title - Texto principal del título
 * @param {string} accent - Texto a destacar en color de acento
 * @param {string} end - Texto final después del acento
 * @param {object} style - Estilos adicionales
 * @param {string} accentColor - Color personalizado para el acento (default: theme.colors.brand.primary)
 * 
 * @example
 * <HeroTitle 
 *   title="Bienvenido a " 
 *   accent="FaceAttend" 
 *   end=" EDU" 
 * />
 */
export default function HeroTitle({ title, accent, end, style, accentColor }) {
    const { fs } = useResponsive();
    const { theme } = useTheme();
    const T = getTypography(fs);
    const c = theme.colors;

    return (
        <Text style={[T.displayLG, { color: c.text.primary }, style]}>
            {title}
            <Text style={{ color: accentColor || c.brand.primary }}>{accent}</Text>
            {end}
        </Text>
    );
}
