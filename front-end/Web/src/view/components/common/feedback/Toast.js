import React, { createContext, useContext, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

// ══════════════════════════════════════════════════════════════
//  Toast Context & Provider
// ══════════════════════════════════════════════════════════════

const ToastContext = createContext(null);

let toastId = 0;

/**
 * ToastProvider - Proveedor del sistema de toasts
 * 
 * Debe envolver la aplicación en un nivel alto para que los toasts
 * sean accesibles desde cualquier componente.
 * 
 * @param {ReactNode} children - Contenido de la aplicación
 * @param {('top'|'bottom'|'center')} position - Posición por defecto de los toasts
 * @param {number} duration - Duración por defecto en ms (3000 = 3s)
 * @param {number} maxToasts - Máximo de toasts simultáneos (3-5 recomendado)
 * 
 * @example
 * // En App.js o Layout principal
 * <ToastProvider position="top" duration={3000} maxToasts={3}>
 *   <YourApp />
 * </ToastProvider>
 */
export function ToastProvider({ 
  children, 
  position = "top",
  duration = 3000,
  maxToasts = 3 
}) {
  const [toasts, setToasts] = useState([]);

  const show = (message, options = {}) => {
    const id = toastId++;
    const toast = {
      id,
      message,
      type: options.type || "info",
      duration: options.duration !== undefined ? options.duration : duration,
      position: options.position || position,
      action: options.action,
      onPress: options.onPress,
    };

    setToasts((prev) => {
      const newToasts = [...prev, toast];
      // Limitar toasts simultáneos
      if (newToasts.length > maxToasts) {
        return newToasts.slice(-maxToasts);
      }
      return newToasts;
    });

    // Auto-dismiss si tiene duración
    if (toast.duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, toast.duration);
    }

    return id;
  };

  const dismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const dismissAll = () => {
    setToasts([]);
  };

  // API simplificada
  const toast = {
    show,
    success: (message, options) => show(message, { ...options, type: "success" }),
    error: (message, options) => show(message, { ...options, type: "error" }),
    warning: (message, options) => show(message, { ...options, type: "warning" }),
    info: (message, options) => show(message, { ...options, type: "info" }),
    dismiss,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ══════════════════════════════════════════════════════════════
//  useToast Hook
// ══════════════════════════════════════════════════════════════

/**
 * useToast - Hook para usar el sistema de toasts
 * 
 * @returns {object} API de toast con métodos: show, success, error, warning, info, dismiss, dismissAll
 * 
 * @example
 * function MyComponent() {
 *   const toast = useToast();
 *   
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       toast.success("Guardado exitosamente");
 *     } catch (error) {
 *       toast.error("Error al guardar");
 *     }
 *   };
 * }
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return context;
}

// ══════════════════════════════════════════════════════════════
//  Toast Container
// ══════════════════════════════════════════════════════════════

function ToastContainer({ toasts, onDismiss }) {
  // Agrupar por posición
  const topToasts = toasts.filter((t) => t.position === "top");
  const bottomToasts = toasts.filter((t) => t.position === "bottom");
  const centerToasts = toasts.filter((t) => t.position === "center");

  return (
    <>
      {/* Top */}
      {topToasts.length > 0 && (
        <View style={[styles.container, styles.containerTop]} pointerEvents="box-none">
          {topToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
          ))}
        </View>
      )}

      {/* Center */}
      {centerToasts.length > 0 && (
        <View style={[styles.container, styles.containerCenter]} pointerEvents="box-none">
          {centerToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
          ))}
        </View>
      )}

      {/* Bottom */}
      {bottomToasts.length > 0 && (
        <View style={[styles.container, styles.containerBottom]} pointerEvents="box-none">
          {bottomToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
          ))}
        </View>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
//  Toast Item (individual)
// ══════════════════════════════════════════════════════════════

function ToastItem({ toast, onDismiss }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    // Animación de entrada
    Animated.spring(animation, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleDismiss = () => {
    // Animación de salida
    Animated.timing(animation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss(toast.id);
    });
  };

  // Configuración por tipo
  const typeConfig = {
    success: {
      icon: "check-circle",
      bgColor: c.status.successLight || "#D1FAE5",
      iconColor: c.status.success,
      textColor: "#065F46",
    },
    error: {
      icon: "x-circle",
      bgColor: c.status.dangerLight || "#FEE2E2",
      iconColor: c.status.danger,
      textColor: "#991B1B",
    },
    warning: {
      icon: "alert-triangle",
      bgColor: c.status.warningLight || "#FEF3C7",
      iconColor: c.status.warning,
      textColor: "#92400E",
    },
    info: {
      icon: "info",
      bgColor: c.brand.primaryLight || "#DBEAFE",
      iconColor: c.brand.primary,
      textColor: "#1E40AF",
    },
  };

  const config = typeConfig[toast.type] || typeConfig.info;

  // Transform para entrada/salida
  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: toast.position === "bottom" ? [100, 0] : [-100, 0],
  });

  const opacity = animation;

  const handlePress = () => {
    if (toast.onPress) {
      toast.onPress();
      handleDismiss();
    }
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: config.bgColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={handlePress}
        disabled={!toast.onPress}
        activeOpacity={toast.onPress ? 0.7 : 1}
      >
        {/* Icono */}
        <View style={styles.iconContainer}>
          <Feather name={config.icon} size={20} color={config.iconColor} />
        </View>

        {/* Mensaje */}
        <Text
          style={[
            styles.message,
            { color: config.textColor, flex: 1 },
          ]}
          numberOfLines={2}
        >
          {toast.message}
        </Text>

        {/* Acción o dismiss */}
        {toast.action ? (
          <TouchableOpacity
            onPress={() => {
              toast.action.onPress();
              handleDismiss();
            }}
            style={styles.actionButton}
          >
            <Text
              style={[
                styles.actionText,
                { color: config.iconColor, fontWeight: "600" },
              ]}
            >
              {toast.action.label}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
            <Feather name="x" size={16} color={config.textColor} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════
//  Styles
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    zIndex: 9999,
  },
  containerTop: {
    top: DESIGN_TOKENS.spacing.xl,
  },
  containerCenter: {
    top: "45%",
  },
  containerBottom: {
    bottom: DESIGN_TOKENS.spacing.xl,
  },
  toast: {
    width: "100%",
    maxWidth: 500,
    marginVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
  },
  actionText: {
    fontSize: 13,
  },
  closeButton: {
    padding: DESIGN_TOKENS.spacing.xs,
  },
});

// ══════════════════════════════════════════════════════════════
//  Exports
// ══════════════════════════════════════════════════════════════

export default { ToastProvider, useToast };
