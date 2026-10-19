import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";
import { Button } from "../buttons/Button";

/**
 * Estado vacío reutilizable para listas sin datos
 * 
 * Componente para mostrar estados vacíos con icono, título, mensaje opcional
 * y acción opcional (botón) para guiar al usuario.
 * 
 * @param {string|ReactNode} icon - Nombre del icono Feather o componente custom
 * @param {string} title - Título principal del estado vacío
 * @param {string} message - Mensaje descriptivo opcional
 * @param {string} actionLabel - Texto del botón de acción
 * @param {function} onAction - Callback al presionar el botón de acción
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // EmptyState básico
 * <EmptyState 
 *   icon="users"
 *   title="No hay estudiantes"
 *   message="Comienza agregando tu primer estudiante"
 * />
 * 
 * @example
 * // EmptyState con acción
 * <EmptyState 
 *   icon="file-text"
 *   title="No hay reportes"
 *   message="Los reportes aparecerán aquí una vez que registres asistencias"
 *   actionLabel="Registrar Asistencia"
 *   onAction={() => navigate('Attendance')}
 * />
 * 
 * @example
 * // EmptyState de búsqueda sin resultados
 * <EmptyState 
 *   icon="search"
 *   title="Sin resultados"
 *   message={`No encontramos estudiantes con "${searchQuery}"`}
 * />
 */
export function EmptyState({
  icon = "inbox",
  title = "No hay datos",
  message,
  actionLabel,
  onAction,
  style,
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.colors.background.hover },
        ]}
      >
        <Feather name={icon} size={48} color={theme.colors.text.disabled} />
      </View>

      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        {title}
      </Text>

      {message && (
        <Text style={[styles.message, { color: theme.colors.text.secondary }]}>
          {message}
        </Text>
      )}

      {actionLabel && onAction && (
        <Button variant="primary" onPress={onAction} style={styles.button}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: DESIGN_TOKENS.spacing.xxl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: DESIGN_TOKENS.borderRadius.round,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: DESIGN_TOKENS.spacing.sm,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: DESIGN_TOKENS.spacing.lg,
    maxWidth: 320,
  },
  button: {
    marginTop: DESIGN_TOKENS.spacing.md,
  },
});

export default EmptyState;
