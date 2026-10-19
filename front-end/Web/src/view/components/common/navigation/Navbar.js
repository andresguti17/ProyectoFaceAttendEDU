import React from "react";
import { View, StyleSheet } from "react-native";
import { useResponsive } from "../../hooks/useResponsive";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Navbar/Header reutilizable y genérico
 * 
 * Barra de navegación flexible que acepta cualquier contenido mediante composition.
 * Soporta layouts responsive, sticky positioning, variantes visuales y más.
 * 
 * @param {ReactNode} left - Contenido izquierdo (logo, back button, etc)
 * @param {ReactNode} center - Contenido central (título, búsqueda, etc)
 * @param {ReactNode} right - Contenido derecho (acciones, perfil, etc)
 * @param {boolean} border - Mostrar borde inferior (default: true)
 * @param {number} height - Altura custom del navbar (opcional)
 * @param {boolean} sticky - Si el navbar es sticky al scroll (default: false)
 * @param {boolean} shadow - Mostrar sombra/elevación (default: false)
 * @param {boolean} transparent - Background transparente (default: false)
 * @param {string} variant - Variante visual: "default" | "transparent" | "floating"
 * @param {number} zIndex - Z-index custom (default: DESIGN_TOKENS.zIndex.sticky)
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * // Navbar básico
 * <Navbar 
 *   left={<Logo />} 
 *   center={<SearchBar />}
 *   right={<ProfileMenu />}
 * />
 * 
 * @example
 * // Navbar sticky con sombra
 * <Navbar 
 *   left={<BackButton />}
 *   center={<Title>Mi Página</Title>}
 *   sticky={true}
 *   shadow={true}
 * />
 * 
 * @example
 * // Navbar transparente para hero sections
 * <Navbar 
 *   left={<Logo />}
 *   right={<Button>Login</Button>}
 *   variant="transparent"
 *   border={false}
 * />
 * 
 * @example
 * // Navbar floating con altura custom
 * <Navbar 
 *   left={<MenuButton />}
 *   center={<BrandName />}
 *   variant="floating"
 *   height={80}
 *   shadow={true}
 * />
 */
export function Navbar({ 
  left, 
  center, 
  right, 
  border = true,
  height,
  sticky = false,
  shadow = false,
  transparent = false,
  variant = "default",
  zIndex = DESIGN_TOKENS.zIndex.sticky,
  style 
}) {
  const { sp } = useResponsive();
  const { theme } = useTheme();

  // Determinar estilos según variant
  const getVariantStyles = () => {
    switch (variant) {
      case "transparent":
        return {
          backgroundColor: "transparent",
          borderBottomWidth: 0,
        };
      case "floating":
        return {
          backgroundColor: theme.colors.background.surface,
          marginHorizontal: sp(16),
          marginTop: sp(16),
          borderRadius: DESIGN_TOKENS.borderRadius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border.primary,
        };
      case "default":
      default:
        return {
          backgroundColor: transparent 
            ? "transparent" 
            : theme.colors.background.surface,
          borderBottomWidth: border ? 1 : 0,
          borderBottomColor: theme.colors.border.primary,
        };
    }
  };

  const variantStyles = getVariantStyles();

  // Estilos de sombra
  const shadowStyles = shadow ? {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  } : {};

  return (
    <View
      style={[
        styles.navbar,
        {
          paddingHorizontal: sp(20),
          paddingVertical: sp(10),
          zIndex,
          ...(height && { height }),
          ...(sticky && { position: "sticky", top: 0 }),
        },
        variantStyles,
        shadowStyles,
        style,
      ]}
    >
      <View style={styles.section}>{left}</View>
      {center && <View style={styles.centerSection}>{center}</View>}
      <View style={styles.section}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: DESIGN_TOKENS.zIndex.sticky,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: DESIGN_TOKENS.spacing.md,
  },
});

export default Navbar;
