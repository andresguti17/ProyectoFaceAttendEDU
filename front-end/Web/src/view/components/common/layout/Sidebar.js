import React from "react";
import { Animated } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useSidebarAnimation } from "../../hooks/useSidebarAnimation";
import { SIDEBAR_CONSTANTS } from "./constants";

/**
 * Sidebar - Contenedor genérico para navegación lateral
 * 
 * Componente flexible que acepta cualquier contenido mediante composition.
 * Soporta collapsed state con animación, position configurable, width personalizable,
 * y accessibility completa.
 * 
 * @param {ReactNode} children - Contenido del sidebar (usar SidebarHeader, SidebarNav, etc.)
 * @param {number} width - Ancho del sidebar (default: 240)
 * @param {number} collapsedWidth - Ancho cuando está collapsed (default: 60)
 * @param {boolean} collapsible - Si permite minimizar (default: false)
 * @param {boolean} collapsed - Estado collapsed (default: false)
 * @param {function} onToggle - Callback al hacer toggle
 * @param {string} position - Posición: "left" | "right" (default: "left")
 * @param {boolean} border - Mostrar borde (default: true)
 * @param {boolean} animated - Animar transición collapsed (default: true)
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * <Sidebar>
 *   <SidebarHeader><Logo /></SidebarHeader>
 *   <SidebarNav>
 *     <SidebarItem icon="home" label="Inicio" active />
 *     <SidebarItem icon="users" label="Usuarios" />
 *   </SidebarNav>
 *   <SidebarFooter>
 *     <SidebarItem icon="log-out" label="Salir" variant="danger" />
 *   </SidebarFooter>
 * </Sidebar>
 * 
 * @example
 * <Sidebar 
 *   collapsible 
 *   collapsed={isCollapsed} 
 *   onToggle={setIsCollapsed}
 *   animated
 * >
 *   <SidebarHeader>Logo</SidebarHeader>
 *   <SidebarNav>
 *     <SidebarItem icon="home" label="Inicio" />
 *   </SidebarNav>
 * </Sidebar>
 */
export default function Sidebar({
    children,
    width = SIDEBAR_CONSTANTS.WIDTH,
    collapsedWidth = SIDEBAR_CONSTANTS.COLLAPSED_WIDTH,
    collapsible = false,
    collapsed = false,
    onToggle,
    position = "left",
    border = true,
    animated = true,
    style,
}) {
    const { theme } = useTheme();
    const c = theme.colors;

    // Usar hook centralizado de animación
    const animatedWidth = useSidebarAnimation({
        collapsed,
        width,
        collapsedWidth,
        animated: animated && collapsible,
        mode: "width"
    });

    const currentWidth = animated && collapsible ? animatedWidth : (collapsed ? collapsedWidth : width);

    const borderStyle = border ? {
        borderRightWidth: position === "left" ? 1 : 0,
        borderLeftWidth: position === "right" ? 1 : 0,
        borderColor: c.border.primary,
    } : {};

    return (
        <Animated.View
            accessibilityRole="navigation"
            accessibilityLabel={collapsed ? "Sidebar colapsado" : "Sidebar"}
            accessibilityState={{ expanded: !collapsed }}
            style={[
                {
                    width: currentWidth,
                    backgroundColor: c.background.surface,
                    height: "100%",
                    flexDirection: "column",
                },
                borderStyle,
                style,
            ]}
        >
            {children}
        </Animated.View>
    );
}
