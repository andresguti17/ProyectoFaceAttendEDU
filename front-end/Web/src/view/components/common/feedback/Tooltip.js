import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Tooltip component para mostrar información contextual
 * 
 * Muestra un mensaje flotante al presionar un elemento. Ideal para ayuda contextual,
 * información adicional o explicaciones breves.
 * 
 * @param {string|ReactNode} content - Contenido del tooltip
 * @param {('top'|'bottom'|'left'|'right')} position - Posición relativa al trigger (default: 'top')
 * @param {ReactNode} children - Elemento que activa el tooltip
 * @param {boolean} disabled - Si el tooltip está deshabilitado
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // Tooltip básico
 * <Tooltip content="Esta es información adicional">
 *   <Feather name="help-circle" size={20} />
 * </Tooltip>
 * 
 * @example
 * // Con posición específica
 * <Tooltip content="Click para editar" position="bottom">
 *   <IconButton icon="edit" />
 * </Tooltip>
 * 
 * @example
 * // Tooltip en texto truncado
 * <Tooltip content={fullText}>
 *   <Text numberOfLines={1}>{fullText}</Text>
 * </Tooltip>
 * 
 * @example
 * // Tooltip con contenido complejo
 * <Tooltip
 *   content={
 *     <View>
 *       <Text style={{ fontWeight: 'bold' }}>Ayuda</Text>
 *       <Text>Esta función permite...</Text>
 *     </View>
 *   }
 * >
 *   <Feather name="info" size={18} />
 * </Tooltip>
 * 
 * @example
 * // Tooltip deshabilitado condicionalmente
 * <Tooltip
 *   content="Información de ayuda"
 *   disabled={!showHelp}
 * >
 *   <Button>Acción</Button>
 * </Tooltip>
 */
export function Tooltip({
  content,
  position = "top",
  children,
  disabled = false,
  style,
}) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const handlePress = () => {
    if (disabled) return;
    setVisible(true);
    // Auto-cerrar después de 3 segundos
    setTimeout(() => setVisible(false), 3000);
  };

  const handleLayout = (event) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setLayout({ x, y, width, height });
  };

  const getTooltipPosition = () => {
    const offset = 8;
    switch (position) {
      case "top":
        return {
          bottom: layout.height + offset,
          left: "50%",
          transform: [{ translateX: -75 }], // Aproximado para centrar
        };
      case "bottom":
        return {
          top: layout.height + offset,
          left: "50%",
          transform: [{ translateX: -75 }],
        };
      case "left":
        return {
          right: layout.width + offset,
          top: "50%",
          transform: [{ translateY: -20 }],
        };
      case "right":
        return {
          left: layout.width + offset,
          top: "50%",
          transform: [{ translateY: -20 }],
        };
      default:
        return {
          bottom: layout.height + offset,
          left: "50%",
          transform: [{ translateX: -75 }],
        };
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        onPress={handlePress}
        onLayout={handleLayout}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>

      {visible && (
        <Modal transparent visible={visible} onRequestClose={() => setVisible(false)}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setVisible(false)}
          >
            <View style={styles.modalContent}>
              <View
                style={[
                  styles.tooltip,
                  {
                    backgroundColor: theme.colors.background.tooltip || theme.colors.text.primary,
                  },
                  getTooltipPosition(),
                ]}
              >
                {typeof content === "string" ? (
                  <Text
                    style={[
                      styles.tooltipText,
                      { color: theme.colors.text.inverse },
                    ]}
                  >
                    {content}
                  </Text>
                ) : (
                  content
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

/**
 * Tooltip.Inline - Versión inline sin Modal (para casos simples)
 * 
 * @example
 * <Tooltip.Inline content="Ayuda">
 *   <Feather name="help-circle" />
 * </Tooltip.Inline>
 */
Tooltip.Inline = function TooltipInline({
  content,
  position = "top",
  children,
  disabled = false,
  style,
}) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  if (disabled) return children;

  return (
    <View style={[styles.inlineContainer, style]}>
      <TouchableOpacity
        onPress={() => setVisible(!visible)}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>

      {visible && (
        <View
          style={[
            styles.inlineTooltip,
            {
              backgroundColor: theme.colors.background.tooltip || theme.colors.text.primary,
            },
            position === "top" && styles.inlineTop,
            position === "bottom" && styles.inlineBottom,
          ]}
        >
          {typeof content === "string" ? (
            <Text
              style={[
                styles.tooltipText,
                { color: theme.colors.text.inverse },
              ]}
            >
              {content}
            </Text>
          ) : (
            content
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  modalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tooltip: {
    position: "absolute",
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.borderRadius.md,
    maxWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  inlineContainer: {
    position: "relative",
  },
  inlineTooltip: {
    position: "absolute",
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.borderRadius.md,
    maxWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  inlineTop: {
    bottom: "100%",
    marginBottom: 8,
    left: "50%",
    transform: [{ translateX: -100 }],
  },
  inlineBottom: {
    top: "100%",
    marginTop: 8,
    left: "50%",
    transform: [{ translateX: -100 }],
  },
});

export default Tooltip;
