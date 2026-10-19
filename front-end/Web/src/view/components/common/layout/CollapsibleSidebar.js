import React, { useRef, useState, useEffect } from "react";
import { View, Animated, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import Sidebar from "./Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { useResponsive } from "../../hooks/useResponsive";
import { useSidebarSwipe } from "../../hooks/useSidebarSwipe";
import { useTabDrag } from "../../hooks/useTabDrag";
import { SIDEBAR_CONSTANTS } from "./constants";

/**
 * CollapsibleSidebar - Sidebar con funcionalidad completa de colapso
 * 
 * @param {ReactNode} children - Contenido del sidebar
 * @param {number} width - Ancho del sidebar expandido (default: 240)
 * @param {boolean} defaultOpen - Estado inicial (default: true en desktop, false en móvil)
 * @param {function} onToggle - Callback cuando cambia el estado
 * @param {boolean} showOverlay - Mostrar overlay cuando está abierto en móvil (default: true)
 * @param {boolean} enableSwipe - Habilitar swipe para abrir/cerrar (default: true)
 * @param {object} style - Estilos adicionales
 */
export default function CollapsibleSidebar({
    children,
    width = SIDEBAR_CONSTANTS.WIDTH,
    defaultOpen,
    onToggle,
    showOverlay = true,
    enableSwipe = true,
    style,
}) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const c = theme.colors;

    // Estado de apertura
    const [isOpen, setIsOpen] = useState(defaultOpen !== undefined ? defaultOpen : !isSmall);
    
    // Animated values
    const translateX = useRef(new Animated.Value(isOpen ? 0 : -width)).current;
    const animatedWidth = useRef(new Animated.Value(isOpen ? width : 0)).current;
    const overlayOpacity = useRef(new Animated.Value(isOpen && isSmall ? SIDEBAR_CONSTANTS.OVERLAY_OPACITY : 0)).current;

    // Toggle función
    const handleToggle = (newState) => {
        setIsOpen(newState);
        if (onToggle) onToggle(newState);
    };

    // Hooks de gestos
    const sidebarPanResponder = useSidebarSwipe({
        enabled: enableSwipe && isSmall,
        isOpen,
        onToggle: handleToggle,
        width,
        translateX
    });

    const tabPanResponder = useTabDrag({
        enabled: enableSwipe && !isSmall,
        isOpen,
        onToggle: handleToggle,
        width,
        translateX,
        animatedWidth
    });

    // Animar cambios de estado
    useEffect(() => {
        if (isSmall) {
            // Móvil: translateX con overlay
            Animated.parallel([
                Animated.spring(translateX, {
                    toValue: isOpen ? 0 : -width,
                    useNativeDriver: true,
                    ...SIDEBAR_CONSTANTS.SPRING_CONFIG,
                }),
                Animated.timing(overlayOpacity, {
                    toValue: isOpen && showOverlay ? SIDEBAR_CONSTANTS.OVERLAY_OPACITY : 0,
                    duration: SIDEBAR_CONSTANTS.ANIMATION_DURATION,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Desktop: translateX + animatedWidth
            Animated.parallel([
                Animated.spring(translateX, {
                    toValue: isOpen ? 0 : -width,
                    useNativeDriver: true,
                    ...SIDEBAR_CONSTANTS.SPRING_CONFIG,
                }),
                Animated.spring(animatedWidth, {
                    toValue: isOpen ? width : 0,
                    useNativeDriver: false,
                    ...SIDEBAR_CONSTANTS.SPRING_CONFIG,
                }),
            ]).start();
        }
    }, [isOpen, width, isSmall, showOverlay]);

    return (
        <Animated.View style={[
            { 
                position: "relative", 
                zIndex: isSmall ? 1000 : 10,
                width: isSmall ? width : animatedWidth,
            },
        ]}>
            {/* Overlay (solo en móvil cuando está abierto) */}
            {isSmall && showOverlay && (
                <Animated.View
                    pointerEvents={isOpen ? "auto" : "none"}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "#000",
                        opacity: overlayOpacity,
                        zIndex: 999,
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => handleToggle(false)}
                        style={{ flex: 1 }}
                    />
                </Animated.View>
            )}

            {/* Sidebar Container */}
            <Animated.View
                style={[
                    {
                        width: width,
                        height: "100%",
                        position: isSmall ? "absolute" : "relative",
                        left: isSmall ? 0 : undefined,
                        top: isSmall ? 0 : undefined,
                        bottom: isSmall ? 0 : undefined,
                        transform: [{ translateX }],
                        zIndex: isSmall ? 1000 : 10,
                        elevation: isSmall ? 10 : 5,
                    },
                    style,
                ]}
                {...(enableSwipe && isSmall ? sidebarPanResponder.panHandlers : {})}
            >
                <Sidebar width={width}>
                    {children}
                </Sidebar>

                {/* Pestañita (Tab Handle) - Solo desktop */}
                {!isSmall && (
                    <View
                        style={{
                            position: "absolute",
                            right: -SIDEBAR_CONSTANTS.TAB_WIDTH,
                            top: 0,
                            bottom: 0,
                            width: SIDEBAR_CONSTANTS.TAB_WIDTH,
                            zIndex: 1000,
                        }}
                    >
                        <View
                            {...(enableSwipe ? tabPanResponder.panHandlers : {})}
                            style={{
                                position: "absolute",
                                left: 0,
                                top: "50%",
                                marginTop: -76,
                                width: 28,
                                height: SIDEBAR_CONSTANTS.TAB_HEIGHT,
                                backgroundColor: c.background.surface,
                                borderTopRightRadius: 12,
                                borderBottomRightRadius: 12,
                                borderWidth: 1,
                                borderLeftWidth: 0,
                                borderColor: c.border.primary,
                                justifyContent: "center",
                                alignItems: "center",
                                shadowColor: "#000",
                                shadowOffset: { width: 2, height: 0 },
                                shadowOpacity: 0.15,
                                shadowRadius: 6,
                                elevation: 15,
                            }}
                        >
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleToggle(!isOpen)}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    justifyContent: "center",
                                    alignItems: "center",
                                }}
                            >
                                <View style={{
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: 6,
                                }}>
                                    {/* Indicador visual (3 líneas) */}
                                    <View style={{ gap: 2.5 }}>
                                        <View style={{
                                            width: 14,
                                            height: 2,
                                            backgroundColor: c.text.tertiary,
                                            borderRadius: 1,
                                        }} />
                                        <View style={{
                                            width: 14,
                                            height: 2,
                                            backgroundColor: c.text.tertiary,
                                            borderRadius: 1,
                                        }} />
                                        <View style={{
                                            width: 14,
                                            height: 2,
                                            backgroundColor: c.text.tertiary,
                                            borderRadius: 1,
                                        }} />
                                    </View>
                                    
                                    {/* Flecha */}
                                    <Feather
                                        name={isOpen ? "chevron-left" : "chevron-right"}
                                        size={18}
                                        color={c.text.secondary}
                                        style={{ transform: [{ translateY: -8 }] }}
                                    />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </Animated.View>
        </Animated.View>
    );
}
