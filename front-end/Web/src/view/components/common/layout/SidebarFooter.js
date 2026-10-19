import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../hooks/useTheme";

/**
 * SidebarFooter - Sección inferior del Sidebar
 * 
 * Contenedor para footer del sidebar (logout, settings, version info, etc).
 * Soporta textos informativos, copyright, y contenido custom.
 * 
 * @param {ReactNode} children - Contenido del footer
 * @param {string} text - Texto informativo (version, copyright, etc)
 * @param {number} padding - Padding interno (default: 0)
 * @param {boolean} border - Mostrar borde superior (default: true)
 * @param {string} align - Alineación del texto: "left" | "center" | "right" (default: "center")
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * // Footer con logout
 * <SidebarFooter>
 *   <SidebarItem 
 *     icon="log-out" 
 *     label="Cerrar sesión" 
 *     variant="danger"
 *     onPress={handleLogout}
 *   />
 * </SidebarFooter>
 * 
 * @example
 * // Footer con version info
 * <SidebarFooter text="v1.0.0" align="center" padding={16} />
 * 
 * @example
 * // Footer con copyright
 * <SidebarFooter 
 *   text="© 2024 Mi App" 
 *   align="center" 
 *   padding={20}
 * />
 * 
 * @example
 * // Footer con settings y logout
 * <SidebarFooter>
 *   <SidebarItem icon="settings" label="Configuración" onPress={...} />
 *   <SidebarDivider />
 *   <SidebarItem icon="log-out" label="Salir" variant="danger" onPress={...} />
 * </SidebarFooter>
 */
export default function SidebarFooter({
    children,
    text,
    padding = 0,
    border = true,
    align = "center",
    style,
}) {
    const { theme } = useTheme();
    const c = theme.colors;

    const textAlignMap = {
        left: "flex-start",
        center: "center",
        right: "flex-end",
    };

    return (
        <View
            style={[
                {
                    padding,
                    borderTopWidth: border ? 1 : 0,
                    borderTopColor: c.border.primary,
                },
                style,
            ]}
        >
            {text ? (
                <View
                    style={{
                        alignItems: textAlignMap[align] || "center",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 12,
                            color: c.text.tertiary,
                        }}
                    >
                        {text}
                    </Text>
                </View>
            ) : (
                children
            )}
        </View>
    );
}
