import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useResponsive } from "../../hooks/useResponsive";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * PageHeader - Header genérico reutilizable para vistas
 * 
 * Header consistente con título, subtítulo y acciones opcionales.
 * Diseñado para ser usado en la parte superior de cada vista principal.
 * Por defecto es sticky y se mantiene visible al hacer scroll.
 * 
 * @param {string} title - Título principal de la vista
 * @param {string} subtitle - Subtítulo descriptivo (opcional)
 * @param {ReactNode} actions - Acciones/botones a la derecha (opcional)
 * @param {boolean} sticky - Si el header es sticky al scroll (default: true)
 * @param {boolean} shadow - Mostrar sombra cuando hace sticky (default: true)
 * @param {boolean} blur - Aplicar backdrop blur (default: true en web)
 * @param {object} style - Estilos adicionales para el contenedor
 * @param {object} titleStyle - Estilos adicionales para el título
 * @param {object} subtitleStyle - Estilos adicionales para el subtítulo
 * 
 * @example
 * <PageHeader 
 *   title="Configuración"
 *   subtitle="Personaliza FaceAttend EDU"
 *   actions={<Button>Guardar</Button>}
 * />
 * 
 * @example
 * // Sin sticky
 * <PageHeader 
 *   title="Dashboard"
 *   subtitle="Vista general del sistema"
 *   sticky={false}
 *   actions={<Button variant="primary">Nueva ficha</Button>}
 * />
 */
export function PageHeader({
    title,
    subtitle,
    actions,
    sticky = true,
    shadow = true,
    blur = true,
    style,
    titleStyle,
    subtitleStyle,
}) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const c = theme.colors;

    // Estilos de sombra para cuando es sticky
    const shadowStyles = shadow && sticky ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    } : {};

    // Backdrop blur para web (efecto glassmorphism)
    const blurStyles = blur && sticky ? {
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)", // Safari support
    } : {};

    return (
        <View
            style={[
                {
                    flexDirection: isSmall ? "column" : "row",
                    justifyContent: "space-between",
                    alignItems: isSmall ? "flex-start" : "center",
                    gap: isSmall ? 12 : 16,
                    paddingTop: 16,
                    paddingBottom: 16,
                    paddingHorizontal: isSmall ? 16 : 24,
                    backgroundColor: `${c.background.app}${blur ? 'E6' : 'FF'}`, // 90% opacity si blur
                    borderBottomWidth: 1,
                    borderBottomColor: c.border.primary,
                    ...(sticky && {
                        position: "sticky",
                        top: 0,
                        zIndex: DESIGN_TOKENS.zIndex.sticky,
                    }),
                },
                shadowStyles,
                blurStyles,
                style,
            ]}
        >
            <View style={{ flex: 1 }}>
                <Text
                    style={[
                        {
                            fontSize: isSmall ? 20 : 24,
                            fontWeight: "700",
                            color: c.text.primary,
                            marginBottom: 4,
                        },
                        titleStyle,
                    ]}
                >
                    {title}
                </Text>
                {subtitle && (
                    <Text
                        style={[
                            {
                                fontSize: isSmall ? 13 : 14,
                                color: c.text.secondary,
                            },
                            subtitleStyle,
                        ]}
                    >
                        {subtitle}
                    </Text>
                )}
            </View>
            {actions && (
                <View style={{ 
                    flexDirection: "row", 
                    gap: 10, 
                    alignItems: "center",
                    flexWrap: "wrap" 
                }}>
                    {actions}
                </View>
            )}
        </View>
    );
}

export default PageHeader;
