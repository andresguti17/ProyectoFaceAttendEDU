import React from "react";
import { ScrollView, View } from "react-native";
import { usePersistentScroll } from "../../hooks/usePersistentScroll";

/**
 * SidebarNav - Sección de navegación del Sidebar
 * 
 * Contenedor scrollable para items de navegación.
 * Usa ScrollView internamente para listas largas.
 * Mantiene la posición de scroll entre re-renders y re-montajes usando estado global.
 * 
 * @param {ReactNode} children - Items de navegación (SidebarItem)
 * @param {boolean} scrollable - Si permite scroll (default: true)
 * @param {object} style - Estilos adicionales
 * @param {object} contentContainerStyle - Estilos del contenedor interno
 * 
 * @example
 * // Navegación básica
 * <SidebarNav>
 *   <SidebarItem icon="home" label="Inicio" active />
 *   <SidebarItem icon="users" label="Usuarios" />
 *   <SidebarItem icon="settings" label="Configuración" />
 * </SidebarNav>
 * 
 * @example
 * // Sin scroll (pocos items)
 * <SidebarNav scrollable={false}>
 *   <SidebarItem icon="home" label="Inicio" />
 *   <SidebarItem icon="users" label="Usuarios" />
 * </SidebarNav>
 */
export default function SidebarNav({
    children,
    scrollable = true,
    style,
    contentContainerStyle,
}) {
    const {
        scrollViewRef,
        handleScroll,
        handleContentSizeChange,
        handleLayout,
    } = usePersistentScroll();
    
    if (!scrollable) {
        return <View style={style}>{children}</View>;
    }

    return (
        <ScrollView
            ref={scrollViewRef}
            style={[{ flex: 1 }, style]}
            contentContainerStyle={contentContainerStyle}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
            scrollEventThrottle={16}
            nestedScrollEnabled={true}
        >
            {children}
        </ScrollView>
    );
}
