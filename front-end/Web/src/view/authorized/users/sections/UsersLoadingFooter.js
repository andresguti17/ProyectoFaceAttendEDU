// ============================================================
//  FaceAttend EDU — UsersLoadingFooter
//
//  Footer persistente para la tabla de usuarios.
//  
//  Siempre visible como último elemento de la tabla:
//  - Mientras carga: muestra spinner + "Cargando [sección]..."
//  - Cuando termina: muestra mensaje de fin "Ya llegaste hasta el final..."
//
//  Características:
//  - Dos estados: loading y complete
//  - Mensajes dinámicos configurables
//  - Diseño consistente con el resto de la tabla
//  - Responsive (desktop/móvil)
// ============================================================

import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../components/hooks/useTheme";
import { useResponsive } from "../../../components/hooks/useResponsive";

/**
 * UsersLoadingFooter - Footer persistente para tabla de usuarios
 * 
 * @param {boolean} isLoading - Si está cargando más usuarios
 * @param {string} loadingMessage - Mensaje mientras carga (ej: "Cargando estudiantes...")
 * @param {string} completeMessage - Mensaje cuando termina (ej: "Ya llegaste hasta el final...")
 * @param {boolean} visible - Si el footer está visible (default: true)
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * <UsersLoadingFooter 
 *   isLoading={vm.isLoading}
 *   loadingMessage="Cargando estudiantes..." 
 *   completeMessage="¡Ya llegaste hasta el final de la lista, no hay más usuarios que mostrar!"
 * />
 */
export default function UsersLoadingFooter({ 
    isLoading = false,
    loadingMessage = "Cargando usuarios...", 
    completeMessage = "¡Ya llegaste hasta el final de la lista, no hay más usuarios que mostrar!",
    visible = true,
    style 
}) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const c = theme.colors;

    if (!visible) {
        return null;
    }

    return (
        <View
            style={[
                {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    paddingVertical: isSmall ? 20 : 24,
                    paddingHorizontal: 16,
                    backgroundColor: c.background.surface,
                    borderTopWidth: 1,
                    borderTopColor: c.border.primary,
                },
                style,
            ]}
        >
            {isLoading ? (
                <>
                    {/* Estado: Cargando */}
                    <ActivityIndicator size={isSmall ? "small" : "large"} color={c.brand.primary} />
                    <Text
                        style={{
                            fontSize: isSmall ? 13 : 14,
                            fontWeight: "500",
                            color: c.text.secondary,
                        }}
                    >
                        {loadingMessage}
                    </Text>
                </>
            ) : (
                <>
                    {/* Estado: Completado */}
                    <Feather name="check-circle" size={isSmall ? 18 : 20} color={c.status.success} />
                    <Text
                        style={{
                            fontSize: isSmall ? 13 : 14,
                            fontWeight: "500",
                            color: c.text.tertiary,
                            textAlign: "center",
                        }}
                    >
                        {completeMessage}
                    </Text>
                </>
            )}
        </View>
    );
}
