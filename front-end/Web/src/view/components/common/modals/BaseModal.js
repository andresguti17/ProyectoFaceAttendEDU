import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useResponsive } from "../../hooks/useResponsive";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Modal base reutilizable con header, body scrollable y footer
 * 
 * @param {boolean} visible - Si el modal está visible
 * @param {function} onClose - Callback al cerrar
 * @param {string} title - Título del modal
 * @param {string} subtitle - Subtítulo opcional
 * @param {string} icon - Nombre del icono (Feather)
 * @param {string} iconColor - Color del icono
 * @param {string} accentColor - Color de barra de acento superior
 * @param {ReactNode} footer - Contenido del footer (botones)
 * @param {number} maxWidth - Ancho máximo del modal
 * @param {string} size - Tamaño: 'sm' | 'md' | 'lg' | 'xl' | 'full'
 * @param {boolean} closeOnBackdrop - Si se cierra al tocar fuera (default: false)
 * @param {boolean} showCloseButton - Si muestra botón de cerrar
 * @param {boolean} bodyScrollEnabled - Si el body puede hacer scroll (default: true)
 * @param {ReactNode} children - Contenido del modal
 * 
 * RECOMENDACIONES DE USO:
 * - closeOnBackdrop=false (default): Modals de registro/edición, confirmaciones críticas
 * - closeOnBackdrop=true: Modals de información/detalle, confirmaciones simples
 */
export function BaseModal({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  iconColor,
  accentColor,
  footer,
  maxWidth,
  size = "md",
  closeOnBackdrop = false,
  showCloseButton = true,
  bodyScrollEnabled = true,
  children,
  style,
}) {
  const { theme } = useTheme();
  const { isSmall } = useResponsive();

  // Tamaños predefinidos
  const sizeConfig = {
    sm: 400,
    md: 500,
    lg: 700,
    xl: 900,
    full: "95%",
  };

  const modalWidth = maxWidth || sizeConfig[size];
  const resolvedIconColor = iconColor || theme.colors.brand.primary;

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={closeOnBackdrop ? onClose : undefined}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={[
            styles.overlay,
            { backgroundColor: theme.colors.background.overlay },
          ]}
          onPress={closeOnBackdrop ? onClose : undefined}
          activeOpacity={1}
          disabled={!closeOnBackdrop}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modal,
              {
                backgroundColor: theme.colors.background.surface,
                width: isSmall ? "100%" : modalWidth,
                ...DESIGN_TOKENS.shadows.lg,
              },
              style,
            ]}
          >
            {/* Barra de acento */}
            {accentColor && (
              <View style={[styles.accent, { backgroundColor: accentColor }]} />
            )}

            {/* Header */}
            <View
              style={[
                styles.header,
                { borderBottomColor: theme.colors.border.primary },
              ]}
            >
              <View style={styles.headerContent}>
                {icon && (
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: resolvedIconColor + "20" },
                    ]}
                  >
                    <Feather name={icon} size={18} color={resolvedIconColor} />
                  </View>
                )}
                <View style={styles.titleContainer}>
                  <Text
                    style={[
                      styles.title,
                      { color: theme.colors.text.primary },
                    ]}
                  >
                    {title}
                  </Text>
                  {subtitle && (
                    <Text
                      style={[
                        styles.subtitle,
                        { color: theme.colors.text.secondary },
                      ]}
                    >
                      {subtitle}
                    </Text>
                  )}
                </View>
              </View>
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={20} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Body */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={bodyScrollEnabled}
            >
              {children}
            </ScrollView>

            {/* Footer */}
            {footer && (
              <View
                style={[
                  styles.footer,
                  { borderTopColor: theme.colors.border.primary },
                ]}
              >
                {footer}
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: DESIGN_TOKENS.spacing.lg,
  },
  modal: {
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    maxHeight: "100%",
    overflow: "hidden",
  },
  accent: {
    height: 5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  body: {
    // Sin padding aquí - el padding va en contentContainerStyle
  },
  bodyContent: {
    padding: DESIGN_TOKENS.spacing.lg,
  },
  footer: {
    flexDirection: "row",
    gap: DESIGN_TOKENS.spacing.md,
    justifyContent: "flex-end",
    padding: DESIGN_TOKENS.spacing.sm,
    borderTopWidth: 1,
  },
});

export default BaseModal;
