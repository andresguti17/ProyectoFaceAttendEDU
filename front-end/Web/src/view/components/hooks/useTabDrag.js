import { useRef, useEffect } from "react";
import { PanResponder, Animated } from "react-native";
import { SIDEBAR_CONSTANTS } from "../common/layout/constants";

/**
 * useTabDrag - Hook para drag de la pestañita del sidebar (desktop)
 * 
 * Gestiona el arrastre de la pestañita para abrir/cerrar sidebar.
 * También anima el width proporcionalmente durante el drag.
 * 
 * @param {object} params
 * @param {boolean} params.enabled - Si está habilitado
 * @param {boolean} params.isOpen - Estado actual
 * @param {function} params.onToggle - Callback para cambiar estado
 * @param {number} params.width - Ancho del sidebar
 * @param {Animated.Value} params.translateX - Valor animado de translateX
 * @param {Animated.Value} params.animatedWidth - Valor animado de width (opcional)
 * @returns {object} PanResponder handlers
 */
export function useTabDrag({
    enabled,
    isOpen,
    onToggle,
    width,
    translateX,
    animatedWidth = null
}) {
    const isOpenRef = useRef(isOpen);
    
    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => enabled,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return enabled && Math.abs(gestureState.dx) > 5;
            },
            onPanResponderMove: (_, gestureState) => {
                const currentIsOpen = isOpenRef.current;
                
                if (!currentIsOpen && gestureState.dx > 0) {
                    const newValue = Math.min(0, -width + gestureState.dx);
                    translateX.setValue(newValue);
                    
                    if (animatedWidth) {
                        const widthValue = width + newValue;
                        animatedWidth.setValue(Math.max(0, widthValue));
                    }
                } else if (currentIsOpen && gestureState.dx < 0) {
                    const newValue = Math.max(-width, gestureState.dx);
                    translateX.setValue(newValue);
                    
                    if (animatedWidth) {
                        const widthValue = width + newValue;
                        animatedWidth.setValue(Math.max(0, widthValue));
                    }
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                const threshold = width * SIDEBAR_CONSTANTS.SWIPE_THRESHOLD_FACTOR;
                const currentIsOpen = isOpenRef.current;
                
                const shouldOpen = !currentIsOpen && (
                    gestureState.dx > threshold || 
                    gestureState.vx > SIDEBAR_CONSTANTS.SWIPE_VELOCITY_THRESHOLD
                );
                
                const shouldClose = currentIsOpen && (
                    gestureState.dx < -threshold || 
                    gestureState.vx < -SIDEBAR_CONSTANTS.SWIPE_VELOCITY_THRESHOLD
                );

                if (shouldOpen) {
                    onToggle(true);
                } else if (shouldClose) {
                    onToggle(false);
                } else {
                    const animations = [
                        Animated.spring(translateX, {
                            toValue: currentIsOpen ? 0 : -width,
                            useNativeDriver: true,
                            ...SIDEBAR_CONSTANTS.SPRING_CONFIG,
                        })
                    ];
                    
                    if (animatedWidth) {
                        animations.push(
                            Animated.spring(animatedWidth, {
                                toValue: currentIsOpen ? width : 0,
                                useNativeDriver: false,
                                ...SIDEBAR_CONSTANTS.SPRING_CONFIG,
                            })
                        );
                    }
                    
                    Animated.parallel(animations).start();
                }
            },
        })
    ).current;

    return panResponder;
}
