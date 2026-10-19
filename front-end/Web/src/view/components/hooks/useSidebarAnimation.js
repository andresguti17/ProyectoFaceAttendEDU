import { useRef, useEffect } from "react";
import { Animated } from "react-native";
import { SIDEBAR_CONSTANTS } from "../common/layout/constants";

/**
 * useSidebarAnimation - Hook para manejar animación de width del sidebar
 * 
 * Centraliza la lógica de animación de collapse/expand del sidebar.
 * Soporta tanto cambio de width como translateX según el modo.
 * 
 * @param {object} params
 * @param {boolean} params.collapsed - Estado collapsed
 * @param {number} params.width - Ancho expandido
 * @param {number} params.collapsedWidth - Ancho collapsed
 * @param {boolean} params.animated - Si debe animar
 * @param {string} params.mode - "width" | "translate" (default: "width")
 * @returns {Animated.Value} Valor animado
 * 
 * @example
 * const animatedWidth = useSidebarAnimation({
 *   collapsed,
 *   width: 240,
 *   collapsedWidth: 60,
 *   animated: true,
 *   mode: "width"
 * });
 */
export function useSidebarAnimation({
    collapsed,
    width = SIDEBAR_CONSTANTS.WIDTH,
    collapsedWidth = SIDEBAR_CONSTANTS.COLLAPSED_WIDTH,
    animated = true,
    mode = "width"
}) {
    const initialValue = mode === "translate"
        ? (collapsed ? -width : 0)
        : (collapsed ? collapsedWidth : width);
    
    const animatedValue = useRef(new Animated.Value(initialValue)).current;

    useEffect(() => {
        const targetValue = mode === "translate"
            ? (collapsed ? -width : 0)
            : (collapsed ? collapsedWidth : width);

        if (animated) {
            Animated.timing(animatedValue, {
                toValue: targetValue,
                duration: SIDEBAR_CONSTANTS.ANIMATION_DURATION,
                useNativeDriver: mode === "translate", // translate soporta native driver, width no
            }).start();
        } else {
            animatedValue.setValue(targetValue);
        }
    }, [collapsed, width, collapsedWidth, animated, mode]);

    return animatedValue;
}
