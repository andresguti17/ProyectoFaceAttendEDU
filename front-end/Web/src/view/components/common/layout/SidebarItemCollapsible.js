import React, { useState, useRef, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { getVariantColors, SIDEBAR_CONSTANTS } from "./constants";

/**
 * SidebarItemCollapsible - Item de navegación con sub-items colapsables
 * 
 * Similar a una carpeta en un IDE: se puede expandir para mostrar sub-items.
 * Soporta estados (active, disabled), animación suave, y mantiene estado de expansión.
 * 
 * @param {string} icon - Nombre del icono Feather
 * @param {string} label - Texto del item principal
 * @param {boolean} active - Si está activo (default: false)
 * @param {Array} children - Array de sub-items con estructura: { key, icon, label, onPress, active }
 * @param {boolean} defaultExpanded - Estado inicial de expansión (default: false)
 * @param {string|number} badge - Badge opcional (ej: notificaciones)
 * @param {string} variant - Variante: "default" | "danger" | "success" | "warning"
 * @param {function} onPress - Callback al presionar el item principal (opcional)
 * @param {function} onExpandedChange - Callback cuando cambia el estado de expansión (opcional)
 * @param {boolean} disabled - Si está deshabilitado (default: false)
 * @param {number} indentSize - Tamaño de indentación para sub-items en px (default: 24)
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * <SidebarItemCollapsible
 *   icon="settings"
 *   label="Configuración"
 *   active={section === "settings"}
 *   defaultExpanded={section.startsWith("settings")}
 *   children={[
 *     { key: "general", icon: "globe", label: "General", onPress: () => setSection("settings:general"), active: section === "settings:general" },
 *     { key: "security", icon: "shield", label: "Seguridad", onPress: () => setSection("settings:security"), active: section === "settings:security" },
 *   ]}
 * />
 */
export default function SidebarItemCollapsible({
    icon,
    label,
    active = false,
    children = [],
    defaultExpanded = false,
    badge,
    variant = "default",
    onPress,
    onExpandedChange,
    disabled = false,
    indentSize = 24,
    style,
}) {
    const { theme } = useTheme();
    const c = theme.colors;

    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const animatedHeight = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;
    const rotateAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;
    
    // Animated value para el ancho del borde izquierdo
    const borderLeftWidthAnim = useRef(new Animated.Value(
        (active || defaultExpanded) ? 3 : 0
    )).current;

    // Determinar si algún hijo está activo (debe estar antes de los useEffect que lo usan)
    // Recalcular en cada render para detectar cambios en children
    const hasActiveChild = useMemo(() => 
        children.some(child => child.active), 
        [children]
    );

    // Usar utility centralizada de colores
    const colors = getVariantColors({
        variant,
        active,
        disabled,
        colors: c
    });

    // Sincronizar estado interno con prop defaultExpanded cuando cambie
    useEffect(() => {
        if (defaultExpanded !== isExpanded) {
            setIsExpanded(defaultExpanded);
            
            // Animar a la nueva posición sin esperar interacción
            Animated.parallel([
                Animated.spring(animatedHeight, {
                    toValue: defaultExpanded ? 1 : 0,
                    useNativeDriver: false,
                    tension: 100,
                    friction: 10,
                }),
                Animated.spring(rotateAnim, {
                    toValue: defaultExpanded ? 1 : 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 10,
                }),
            ]).start();
        }
    }, [defaultExpanded, isExpanded, animatedHeight, rotateAnim]);
    
    // Animar el borde izquierdo cuando cambie active, hasActiveChild o isExpanded
    useEffect(() => {
        Animated.spring(borderLeftWidthAnim, {
            toValue: (active || hasActiveChild || isExpanded) ? 3 : 0,
            useNativeDriver: false,
            tension: 100,
            friction: 10,
        }).start();
    }, [active, hasActiveChild, isExpanded, borderLeftWidthAnim]);

    // Toggle expansión
    const handleToggle = () => {
        const newExpandedState = !isExpanded;
        setIsExpanded(newExpandedState);
        
        // Notificar cambio de expansión
        if (onExpandedChange) {
            onExpandedChange(newExpandedState);
        }

        // Animar altura y rotación del chevron
        Animated.parallel([
            Animated.spring(animatedHeight, {
                toValue: newExpandedState ? 1 : 0,
                useNativeDriver: false,
                tension: 100,
                friction: 10,
            }),
            Animated.spring(rotateAnim, {
                toValue: newExpandedState ? 1 : 0,
                useNativeDriver: true,
                tension: 100,
                friction: 10,
            }),
        ]).start();
    };

    // Rotación del chevron
    const chevronRotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "90deg"],
    });

    // Calcular altura máxima basada en número de hijos
    // Incluye: items (44px cada uno) + padding container (8px) + separadores (2px cada uno)
    const childrenHeight = (children.length * 44) + 8 + 4;

    // Handler del item principal
    const handleMainPress = () => {
        // Si hay onPress, ejecutarlo (marca como activo)
        if (onPress) {
            onPress();
        }
        
        // Lógica de colapso inteligente:
        // - Si está expandido Y el item padre está activo: es un "segundo click" → colapsar
        // - Si está expandido Y algún hijo está activo: navegando desde hijo a padre → NO colapsar
        // - Si está colapsado: expandir
        if (children.length > 0) {
            if (isExpanded && active && !hasActiveChild) {
                // Segundo click en el item padre cuando ya está activo → colapsar
                handleToggle();
            } else if (!isExpanded) {
                // Está colapsado → expandir
                handleToggle();
            }
            // Si está expandido y navegando desde hijo → no hacer nada (mantener expandido)
        }
    };

    return (
        <View style={style}>
            {/* Item Principal */}
            <TouchableOpacity
                onPress={handleMainPress}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{
                    disabled,
                    selected: active,
                    expanded: isExpanded,
                }}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: SIDEBAR_CONSTANTS.ITEM_PADDING,
                    backgroundColor: active || hasActiveChild || isExpanded ? colors.bg : "transparent",
                }}
                activeOpacity={0.7}
            >
                {/* Borde izquierdo animado */}
                <Animated.View
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: borderLeftWidthAnim,
                        backgroundColor: colors.border,
                    }}
                />
                
                {/* Icono principal */}
                {icon && (
                    <Feather 
                        name={icon} 
                        size={20} 
                        color={colors.icon} 
                    />
                )}

                {/* Label */}
                <Text
                    style={{
                        fontSize: 14,
                        fontWeight: active || hasActiveChild || isExpanded ? "600" : "400",
                        color: colors.text,
                        flex: 1,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {label}
                </Text>

                {/* Badge */}
                {badge && (
                    <View
                        style={{
                            backgroundColor: c.status.error,
                            borderRadius: 10,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            minWidth: 20,
                            alignItems: "center",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: "600",
                                color: "#FFF",
                            }}
                        >
                            {badge}
                        </Text>
                    </View>
                )}

                {/* Chevron para indicar expansión (solo si hay children) */}
                {children.length > 0 && (
                    <Animated.View
                        style={{
                            transform: [{ rotate: chevronRotation }],
                        }}
                    >
                        <Feather 
                            name="chevron-right" 
                            size={16} 
                            color={c.text.tertiary} 
                            style={{ opacity: 0.5 }}
                        />
                    </Animated.View>
                )}
            </TouchableOpacity>

            {/* Sub-items colapsables */}
            {children.length > 0 && (
                <Animated.View
                    style={{
                        maxHeight: animatedHeight.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, childrenHeight],
                        }),
                        overflow: "hidden",
                        opacity: animatedHeight,
                    }}
                >
                    {/* Separador sutil superior */}
                    <View style={{
                        height: 1,
                        backgroundColor: c.border.primary,
                        marginHorizontal: 12,
                        opacity: 0.3,
                    }} />
                    
                    <View style={{
                        backgroundColor: c.background.app,
                        paddingVertical: 4,
                    }}>
                        {children.map((child) => {
                            const childColors = getVariantColors({
                                variant: child.variant || "default",
                                active: child.active || false,
                                disabled: child.disabled || false,
                                colors: c
                            });

                            return (
                                <TouchableOpacity
                                    key={child.key}
                                    onPress={child.onPress}
                                    disabled={child.disabled}
                                    accessibilityRole="button"
                                    accessibilityLabel={child.label}
                                    accessibilityState={{
                                        disabled: child.disabled,
                                        selected: child.active,
                                    }}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 10,
                                        paddingVertical: 9,
                                        paddingLeft: SIDEBAR_CONSTANTS.ITEM_PADDING + indentSize,
                                        paddingRight: SIDEBAR_CONSTANTS.ITEM_PADDING,
                                        backgroundColor: child.active ? `${childColors.bg}80` : "transparent",
                                        marginHorizontal: 8,
                                        borderRadius: 8,
                                        marginVertical: 1,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    {/* Indicador visual de jerarquía */}
                                    <View style={{
                                        width: 2,
                                        height: "100%",
                                        backgroundColor: child.active ? childColors.border : c.border.primary,
                                        position: "absolute",
                                        left: 12,
                                        opacity: child.active ? 1 : 0.3,
                                    }} />
                                    
                                    {/* Icono del sub-item */}
                                    {child.icon && (
                                        <Feather 
                                            name={child.icon} 
                                            size={16} 
                                            color={childColors.icon}
                                            style={{ opacity: child.active ? 1 : 0.85 }}
                                        />
                                    )}

                                    {/* Label del sub-item */}
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: child.active ? "600" : "400",
                                            color: childColors.text,
                                            flex: 1,
                                            opacity: child.active ? 1 : 0.85,
                                        }}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {child.label}
                                    </Text>

                                    {/* Badge del sub-item */}
                                    {child.badge && (
                                        <View
                                            style={{
                                                backgroundColor: c.status.error,
                                                borderRadius: 10,
                                                paddingHorizontal: 6,
                                                paddingVertical: 2,
                                                minWidth: 18,
                                                alignItems: "center",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: "600",
                                                    color: "#FFF",
                                                }}
                                            >
                                                {child.badge}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Indicador especial del sub-item (opcional) */}
                                    {child.indicator && (
                                        <Feather 
                                            name={child.indicator} 
                                            size={12} 
                                            color="#F59E0B" 
                                        />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    
                    {/* Separador sutil inferior */}
                    <View style={{
                        height: 1,
                        backgroundColor: c.border.primary,
                        marginHorizontal: 12,
                        opacity: 0.3,
                    }} />
                </Animated.View>
            )}
        </View>
    );
}
