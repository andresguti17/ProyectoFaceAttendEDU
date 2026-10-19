import React from "react";
import { Text, StyleSheet } from "react-native";
import { BaseModal } from "./BaseModal";
import { Button } from "../buttons/Button";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";
import { useTheme } from "../../hooks/useTheme";

/**
 * Modal de confirmación (Sí/No, Aceptar/Cancelar)
 * 
 * @param {boolean} visible - Si está visible
 * @param {function} onClose - Callback al cerrar
 * @param {function} onConfirm - Callback al confirmar
 * @param {string} title - Título
 * @param {string} message - Mensaje
 * @param {string} variant - Estilo: 'default' | 'danger' | 'warning'
 * @param {string} confirmText - Texto del botón confirmar
 * @param {string} cancelText - Texto del botón cancelar
 * @param {boolean} loading - Si está cargando
 */
export function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  title = "¿Estás seguro?",
  message,
  variant = "default",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  loading = false,
}) {
  const { theme } = useTheme();

  const icons = {
    default: "info",
    danger: "alert-circle",
    warning: "alert-triangle",
  };

  const colors = {
    default: theme.colors.brand.primary,
    danger: theme.colors.status.error,
    warning: theme.colors.status.warning,
  };

  const buttonVariants = {
    default: "primary",
    danger: "danger",
    warning: "primary",
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      closeOnBackdrop={true}
      title={title}
      icon={icons[variant]}
      iconColor={colors[variant]}
      size="sm"
      footer={
        <>
          <Button variant="outline" onPress={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={buttonVariants[variant]}
            onPress={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <Text style={[styles.message, { color: theme.colors.text.primary }]}>
        {message}
      </Text>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
});

export default ConfirmModal;
