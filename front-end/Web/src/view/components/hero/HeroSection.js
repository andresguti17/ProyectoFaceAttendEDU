import React from "react";
import { Animated, View } from "react-native";
import { useResponsive } from "../hooks/useResponsive";

/**
 * HeroSection - Contenedor genérico para secciones hero
 * 
 * Componente flexible que acepta cualquier contenido mediante children.
 * Soporta animaciones fade/slide y layout configurable.
 * 
 * @param {ReactNode} children - Contenido flexible (HeroTitle, Buttons, HeroStats, etc.)
 * @param {Animated.Value} fadeAnim - Animación de fade (opcional)
 * @param {Animated.Value} slideAnim - Animación de slide (opcional)
 * @param {string} layout - Layout: "column" | "row"
 * @param {string} align - Alineación: "flex-start" | "center" | "flex-end" | "stretch"
 * @param {number} gap - Espaciado entre children
 * @param {number} minWidth - Ancho mínimo
 * @param {number} maxWidth - Ancho máximo
 * @param {number} flex - Flex grow
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * // Uso básico con composition
 * <HeroSection fadeAnim={fadeLeft} slideAnim={slideLeft}>
 *   <HeroTitle title="Título" accent="destacado" />
 *   <Button label="Acción" onPress={...} />
 *   <HeroStats stats={statsData} />
 * </HeroSection>
 * 
 * @example
 * // Layout horizontal personalizado
 * <HeroSection layout="row" align="center" gap={24}>
 *   <Icon name="check" />
 *   <Text>Contenido custom</Text>
 * </HeroSection>
 */
export default function HeroSection({
    children,
    fadeAnim,
    slideAnim,
    layout = "column",
    align = "flex-start",
    gap = 36,
    minWidth,
    maxWidth,
    flex = 1,
    style,
}) {
    const { sp, vp } = useResponsive();

    const baseStyle = {
        flex,
        flexDirection: layout,
        alignItems: align,
        gap: sp(gap),
        paddingTop: vp(6),
    };

    if (minWidth) baseStyle.minWidth = sp(minWidth);
    if (maxWidth) baseStyle.maxWidth = sp(maxWidth);

    const animatedStyle = {};
    if (fadeAnim) animatedStyle.opacity = fadeAnim;
    if (slideAnim) animatedStyle.transform = [{ translateX: slideAnim }];

    return (
        <Animated.View style={[baseStyle, animatedStyle, style]}>
            {children}
        </Animated.View>
    );
}
