import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Loader/Spinner reutilizable para estados de carga
 * 
 * Componente de indicador de carga con soporte para mensaje opcional
 * y modo fullscreen para loading de página completa.
 * 
 * @param {('small'|'large')} size - Tamaño del spinner
 * @param {string} message - Mensaje opcional debajo del spinner
 * @param {boolean} fullScreen - Si debe ocupar toda la pantalla
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // Loader básico
 * <Loader />
 * 
 * @example
 * // Loader con mensaje
 * <Loader message="Cargando estudiantes..." />
 * 
 * @example
 * // Loader fullscreen
 * <Loader fullScreen message="Iniciando sesión..." />
 * 
 * @example
 * // Loader pequeño en línea
 * <Loader size="small" />
 */
export function Loader({
  size = "large",
  message,
  fullScreen = false,
  style,
}) {
  const { theme } = useTheme();

  const content = (
    <>
      <ActivityIndicator size={size} color={theme.colors.brand.primary} />
      {message && (
        <Text
          style={[
            styles.message,
            { color: theme.colors.text.secondary },
          ]}
        >
          {message}
        </Text>
      )}
    </>
  );

  if (fullScreen) {
    return (
      <View
        style={[
          styles.fullScreen,
          { backgroundColor: theme.colors.background.app },
          style,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: DESIGN_TOKENS.spacing.xl,
  },
  message: {
    marginTop: DESIGN_TOKENS.spacing.md,
    fontSize: 14,
  },
});

export default Loader;
