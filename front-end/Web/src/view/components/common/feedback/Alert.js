import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Alert reutilizable para mostrar mensajes contextuales
 * 
 * Componente de alerta para mostrar mensajes de información, éxito, advertencia o error
 * en contexto. Con soporte para título, icono automático y opción de cerrar.
 * 
 * @param {('info'|'success'|'warning'|'error')} type - Tipo de alerta
 * @param {string} title - Título opcional del alert
 * @param {string} message - Mensaje principal del alert
 * @param {boolean} closable - Si se puede cerrar con botón X
 * @param {function} onClose - Callback al cerrar el alert
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // Alert de información
 * <Alert 
 *   type="info"
 *   message="Los cambios se guardarán automáticamente"
 * />
 * 
 * @example
 * // Alert de éxito con título
 * <Alert 
 *   type="success"
 *   title="Guardado exitoso"
 *   message="El estudiante ha sido registrado correctamente"
 * />
 * 
 * @example
 * // Alert de advertencia cerrable
 * <Alert 
 *   type="warning"
 *   message="La asistencia mínima requerida es 80%"
 *   closable
 *   onClose={() => setShowWarning(false)}
 * />
 * 
 * @example
 * // Alert de error
 * <Alert 
 *   type="error"
 *   title="Error de conexión"
 *   message="No se pudo conectar con el servidor. Verifica tu conexión a internet."
 * />
 */
export function Alert({
  type = "info",
  title,
  message,
  closable = false,
  onClose,
  style,
}) {
  const { theme } = useTheme();

  const config = {
    info: {
      icon: "info",
      backgroundColor: theme.colors.status.infoLight,
      color: theme.colors.status.info,
    },
    success: {
      icon: "check-circle",
      backgroundColor: theme.colors.status.successLight,
      color: theme.colors.status.success,
    },
    warning: {
      icon: "alert-triangle",
      backgroundColor: theme.colors.status.warningLight,
      color: theme.colors.status.warning,
    },
    error: {
      icon: "x-circle",
      backgroundColor: theme.colors.status.errorLight,
      color: theme.colors.status.error,
    },
  };

  const alertConfig = config[type];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: alertConfig.backgroundColor },
        style,
      ]}
    >
      <Feather
        name={alertConfig.icon}
        size={22}
        color={alertConfig.color}
        style={styles.icon}
      />

      <View style={styles.content}>
        {title && (
          <Text style={[styles.title, { color: alertConfig.color }]}>
            {title}
          </Text>
        )}
        <Text style={[styles.message, { color: alertConfig.color }]}>
          {message}
        </Text>
      </View>

      {closable && onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Feather name="x" size={18} color={alertConfig.color} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: DESIGN_TOKENS.spacing.md + 2,
    borderRadius: DESIGN_TOKENS.borderRadius.md,
    borderLeftWidth: 4,
  },
  icon: {
    marginRight: DESIGN_TOKENS.spacing.md,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: DESIGN_TOKENS.spacing.xs + 2,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  closeButton: {
    marginLeft: DESIGN_TOKENS.spacing.md,
    padding: DESIGN_TOKENS.spacing.xs + 2,
  },
});

export default Alert;
