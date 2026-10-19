import React from "react";
import { Animated, Image, View } from "react-native";
import FloatingBadge from "../common/badges/FloatingBadge";
import { useResponsive } from "../hooks/useResponsive";
import { useTheme } from "../hooks/useTheme";

/**
 * HeroMediaSection - Sección multimedia genérica para hero
 * 
 * Muestra imagen/logo con decoraciones opcionales (círculo) y badges flotantes.
 * Totalmente configurable mediante props.
 * 
 * @param {ImageSource} mediaSource - Imagen/logo (require() o {uri: '...'})
 * @param {number} mediaSize - Tamaño del contenedor (auto-responsive si no se provee)
 * @param {boolean} decorationCircle - Mostrar círculo decorativo de fondo
 * @param {string} circleColor - Color del círculo (default: theme.colors.brand.primaryLight)
 * @param {number} circleOpacity - Opacidad del círculo (default: 0.7)
 * @param {Array} badges - Array de badges flotantes [{label, icon, delay, style}]
 * @param {Animated.Value} fadeAnim - Animación de fade (opcional)
 * @param {Animated.Value} slideAnim - Animación de slide (opcional)
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * // Hero con imagen y badges
 * <HeroMediaSection 
 *   mediaSource={require("../../../assets/images/hero.png")}
 *   badges={[
 *     { label: "Online", icon: "✅", delay: 0, style: { top: 20, left: 20 } }
 *   ]}
 *   fadeAnim={fadeRight}
 *   slideAnim={slideRight}
 * />
 * 
 * @example
 * // Sin círculo decorativo, tamaño custom
 * <HeroMediaSection 
 *   mediaSource={require("./logo.png")}
 *   decorationCircle={false}
 *   mediaSize={300}
 * />
 * 
 * @example
 * // Solo badges, sin imagen
 * <HeroMediaSection 
 *   badges={customBadges}
 *   decorationCircle={false}
 * />
 */
export default function HeroMediaSection({
    mediaSource,
    mediaSize,
    decorationCircle = true,
    circleColor,
    circleOpacity = 0.7,
    badges = [],
    fadeAnim,
    slideAnim,
    style,
}) {
    const { sp, isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;

    // Tamaños responsive o custom
    const containerSize = mediaSize || (isSmall ? sp(260) : sp(400));
    const circleSize = containerSize * 0.8;
    const logoSize = containerSize * 0.5;

    const baseStyle = {
        width: containerSize,
        height: containerSize,
        alignItems: "center",
        justifyContent: "center",
    };

    const animatedStyle = {};
    if (fadeAnim) animatedStyle.opacity = fadeAnim;
    if (slideAnim) animatedStyle.transform = [{ translateX: slideAnim }];

    return (
        <Animated.View style={[baseStyle, animatedStyle, style]}>
            {/* Círculo decorativo de fondo */}
            {decorationCircle && (
                <View
                    style={{
                        position: "absolute",
                        width: circleSize,
                        height: circleSize,
                        borderRadius: circleSize / 2,
                        backgroundColor: circleColor || c.brand.primaryLight,
                        opacity: circleOpacity,
                    }}
                />
            )}

            {/* Imagen/Logo principal */}
            {mediaSource && (
                <Image
                    source={mediaSource}
                    style={{ width: logoSize, height: logoSize, zIndex: 1 }}
                    resizeMode="contain"
                />
            )}

            {/* Badges flotantes */}
            {badges.map((badge, idx) => (
                <FloatingBadge
                    key={badge.label || `badge-${idx}`}
                    label={badge.label}
                    icon={badge.icon}
                    delay={badge.delay}
                    style={badge.style}
                />
            ))}
        </Animated.View>
    );
}
