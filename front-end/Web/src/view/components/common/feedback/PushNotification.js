// ============================================================
//  PushNotification — Sistema de notificaciones push parametrizable
//
//  Sistema completo de notificaciones tipo popup que pueden:
//  - Aparecer desde cualquier módulo
//  - Redirigir a cualquier pantalla
//  - Tener duración configurable
//  - Ser completamente parametrizables
//
//  Características:
//  - Soporte para múltiples tipos (info, success, warning, error, custom)
//  - Navegación integrada con onNavigate callback
//  - Duración configurable desde settings (segundos a minutos)
//  - Animaciones suaves de entrada/salida
//  - Acciones personalizables
//  - Agrupación por prioridad
// ============================================================

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import tinycolor from "tinycolor2";
import { useTheme } from "../../hooks/useTheme";
import { getContrastTextColor } from "../../../../core/utils/colorHelpers";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";
import { getInstitutionConfig } from "../../../../core/config/institutionConfig";

// ══════════════════════════════════════════════════════════════
//  Push Notification Context
// ══════════════════════════════════════════════════════════════

const PushNotificationContext = createContext(null);

let notificationId = 0;

/**
 * PushNotificationProvider - Proveedor del sistema de notificaciones push
 * 
 * Debe envolver la aplicación para que las notificaciones sean accesibles globalmente.
 * 
 * @param {ReactNode} children - Contenido de la aplicación
 * @param {number} defaultDuration - Duración por defecto en milisegundos (puede ser sobrescrita)
 * @param {number} maxNotifications - Máximo de notificaciones simultáneas
 * @param {function} onNavigate - Callback global para navegación (recibe { screen, params })
 * 
 * @example
 * <PushNotificationProvider 
 *   defaultDuration={5000} 
 *   maxNotifications={5}
 *   onNavigate={({ screen, params }) => navigation.navigate(screen, params)}
 * >
 *   <App />
 * </PushNotificationProvider>
 */
export function PushNotificationProvider({ 
  children, 
  defaultDuration, // Parámetro deprecado, se usa institutionConfig
  maxNotifications = 15,
  maxNotificationsByType = 5,
  onNavigate 
}) {
  const [notifications, setNotifications] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]); // Cola de notificaciones pendientes
  const [processedFromQueue, setProcessedFromQueue] = useState(0); // Contador de notificaciones liberadas de cola

  // Obtener duración por defecto desde configuración
  const getDefaultDuration = () => {
    const config = getInstitutionConfig();
    return (config.pushDuration || 4) * 1000; // Convertir segundos a milisegundos
  };

  /**
   * Generar clave única para detectar duplicados
   * @param {Object} notification - Configuración de la notificación
   * @returns {string} Clave única
   */
  const generateNotificationKey = (notification) => {
    // Combinar type, title y message para crear una clave única
    const keyParts = [
      notification.type || 'info',
      notification.title || '',
      notification.message || '',
      notification.source || 'system'
    ];
    return keyParts.join('|').toLowerCase();
  };

  /**
   * Verificar si una notificación es duplicada
   * @param {Object} newNotification - Nueva notificación a verificar
   * @returns {boolean} True si es duplicada
   */
  const isDuplicateNotification = (newNotification) => {
    const newKey = generateNotificationKey(newNotification);
    
    // Verificar en notificaciones activas
    const isDuplicateInActive = notifications.some(notification => 
      generateNotificationKey(notification) === newKey
    );
    
    // Verificar en cola pendiente
    const isDuplicateInQueue = pendingQueue.some(notification => 
      generateNotificationKey(notification) === newKey
    );
    
    return isDuplicateInActive || isDuplicateInQueue;
  };

  /**
   * Contar notificaciones del mismo tipo
   * @param {string} type - Tipo de notificación
   * @param {string} source - Fuente de notificación
   * @returns {number} Cantidad de notificaciones del mismo tipo
   */
  const countNotificationsByType = (type, source) => {
    const activeCount = notifications.filter(notification => 
      notification.type === type && notification.source === source
    ).length;
    
    const queueCount = pendingQueue.filter(notification => 
      notification.type === type && notification.source === source
    ).length;
    
    return activeCount + queueCount;
  };

  // Helper para contar notificaciones por source (total)
  const countNotificationsBySource = (source) => {
    const activeCount = notifications.filter(n => n.source === source).length;
    const queueCount = pendingQueue.filter(n => n.source === source).length;
    return activeCount + queueCount;
  };

  /**
   * Calcular duración incremental basada en el total de notificaciones ya procesadas
   * @param {number} totalProcessed - Total de notificaciones que ya han sido procesadas desde cola
   * @returns {number} Milisegundos adicionales
   */
  const getIncrementalDuration = (totalProcessed) => {
    // Solo aplicar incremento a partir de que hayamos superado el límite inicial
    // Si ya procesamos algunas de la cola, aplicar incremento progresivo
    if (totalProcessed === 0) return 0; // Primera notificación liberada: sin incremento
    
    // Fórmula incremental: 1ra liberada = +0s, 2da = +2s, 3ra = +5s, 4ta = +10s, etc.
    const increments = [2000, 5000, 10000, 20000, 35000, 55000]; // En milisegundos
    
    if (totalProcessed - 1 < increments.length) {
      return increments[totalProcessed - 1];
    }
    
    // Para posiciones mayores, incremento exponencial
    return increments[increments.length - 1] + (totalProcessed - increments.length) * 30000;
  };

  /**
   * Procesar la cola de notificaciones pendientes
   * Libera notificaciones cuando hay cupo disponible
   */
  const processQueue = () => {
    setNotifications((currentNotifications) => {
      setPendingQueue((currentQueue) => {
        if (currentQueue.length === 0 || currentNotifications.length >= maxNotifications) {
          return currentQueue;
        }

        // Cuántas notificaciones podemos mostrar
        const availableSlots = maxNotifications - currentNotifications.length;
        const toShow = currentQueue.slice(0, availableSlots);
        const remaining = currentQueue.slice(availableSlots);

        // Agregar duración incremental a las notificaciones liberadas de la cola
        const processedNotifications = toShow.map((notification, index) => {
          // Calcular duración incremental basada en cuántas ya han sido procesadas
          const incrementalDuration = getIncrementalDuration(processedFromQueue + index + 1);
          
          return {
            ...notification,
            duration: notification.originalDuration + incrementalDuration,
            wasQueued: true,
            queuePosition: processedFromQueue + index + 1, // Posición global de procesamiento
          };
        });

        // Actualizar contador de notificaciones procesadas de la cola
        setProcessedFromQueue(prev => prev + toShow.length);

        // Agregar las notificaciones procesadas a las actuales
        setNotifications((prev) => {
          const combined = [...prev, ...processedNotifications];
          
          // Ordenar por prioridad
          const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
          combined.sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
          );

          return combined;
        });

        // Configurar auto-dismiss para las notificaciones liberadas
        processedNotifications.forEach((notification) => {
          if (notification.duration > 0) {
            setTimeout(() => {
              dismiss(notification.id, 'timeout');
            }, notification.duration);
          }
        });

        return remaining;
      });

      return currentNotifications;
    });
  };

  /**
   * Mostrar una notificación push simple y directo
   * 
   * @param {object} config - Configuración de la notificación
   * @param {string} config.title - Título de la notificación
   * @param {string} config.message - Mensaje de la notificación
   * @param {('info'|'success'|'warning'|'error'|'custom')} config.type - Tipo de notificación
   * @param {number} config.duration - Duración en ms (si no se especifica, usa institutionConfig.pushDuration)
   * @param {string} config.icon - Icono personalizado (Feather icon name)
   * @param {object} config.navigation - Objeto de navegación { screen, params }
   * @param {object} config.action - Acción personalizada { label, onPress }
   * @param {string} config.source - Módulo/pantalla desde donde se origina
   * @param {('low'|'normal'|'high'|'urgent')} config.priority - Prioridad de la notificación
   * @param {object} config.data - Datos adicionales para la notificación
   * @param {function} config.onPress - Callback al hacer click en la notificación
   * @param {function} config.onDismiss - Callback al cerrar la notificación
   * @param {boolean} config.allowDuplicates - Permitir notificaciones duplicadas (default: false)
   * 
   * ===== NUEVAS PROPIEDADES PARA NOTIFICACIONES "ÚNICAS" =====
   * @param {number} config.maxNotifications - Sobrescribir límite total de notificaciones
   * @param {number} config.maxNotificationsByType - Sobrescribir límite por tipo
   * @param {boolean} config.isActiveSource - Si la fuente está "activa" (cambia comportamiento)
   * @param {boolean} config.isResolved - Si la fuente está "resuelta" (puede cambiar duración, etc.)
   * @param {function} config.onSourceResolved - Callback cuando la fuente se resuelve
   * 
   * @returns {Promise<number|null>} ID de la notificación o null si fue rechazada
   */
  const show = async (config) => {
    // Usar duración desde configuración si no se especifica
    const defaultDur = getDefaultDuration();
    let finalDuration = config.duration !== undefined ? config.duration : defaultDur;
    
    // ===== LÓGICA SIMPLE DE RESOLUCIÓN =====
    // Si la fuente está resuelta, cambiar comportamiento (ej: duración más corta)
    if (config.isResolved) {
      finalDuration = 2000; // 2 segundos para fuentes resueltas
    } else if (config.isActiveSource) {
      // Si la fuente está activa pero no resuelta, duración más larga
      finalDuration = finalDuration * 1.5; // 1.5x la duración normal
    }

    // ===== LÍMITES CONFIGURABLES PARA NOTIFICACIONES "ÚNICAS" =====
    const currentMaxNotifications = config.maxNotifications !== undefined 
      ? config.maxNotifications 
      : maxNotifications;
    
    const currentMaxByType = config.maxNotificationsByType !== undefined 
      ? config.maxNotificationsByType 
      : maxNotificationsByType;

    // Crear objeto de notificación simple
    const notification = {
      id: notificationId++,
      title: config.title || "Notificación",
      message: config.message || "",
      type: config.type || "info",
      duration: finalDuration,
      originalDuration: finalDuration,
      icon: config.icon,
      navigation: config.navigation,
      action: config.action,
      source: config.source || "system",
      priority: config.priority || "normal",
      data: config.data || {},
      onPress: config.onPress,
      onDismiss: config.onDismiss,
      timestamp: () => Date.now(), // Función que devuelve timestamp
      wasQueued: false,
      allowDuplicates: config.allowDuplicates || false,
      
      // ===== PROPIEDADES SIMPLES DE RESOLUCIÓN =====
      isActiveSource: config.isActiveSource || false,
      isResolved: config.isResolved || false,
      onSourceResolved: config.onSourceResolved || null,
      
      // ===== LÍMITES PERSONALIZADOS =====
      maxNotifications: currentMaxNotifications,
      maxNotificationsByType: currentMaxByType,
      maxNotificationsBySource: config.maxNotificationsBySource, // Nuevo límite por source
    };

    // 1. Verificar duplicados (a menos que se permitan explícitamente)
    if (!notification.allowDuplicates && isDuplicateNotification(notification)) {
      return null;
    }

    // 2. Verificar límite por tipo (usar límite personalizado si existe)
    const currentTypeCount = countNotificationsByType(notification.type, notification.source);
    if (currentTypeCount >= currentMaxByType) {
      return null;
    }

    // 3. Verificar límite por source (si se especifica)
    if (notification.maxNotificationsBySource) {
      const currentSourceCount = countNotificationsBySource(notification.source);
      if (currentSourceCount >= notification.maxNotificationsBySource) {
        return null;
      }
    }

    setNotifications((currentNotifications) => {
      // 4. Si hay espacio en pantalla (usar límite personalizado), mostrar inmediatamente
      if (currentNotifications.length < currentMaxNotifications) {
        const newNotifications = [...currentNotifications, notification];
        
        // Ordenar por prioridad
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        newNotifications.sort((a, b) => 
          priorityOrder[a.priority] - priorityOrder[b.priority]
        );

        // Auto-dismiss si tiene duración
        if (notification.duration > 0) {
          setTimeout(() => {
            dismiss(notification.id, 'timeout');
          }, notification.duration);
        }

        return newNotifications;
      } else {
        // 5. No hay espacio, agregar a la cola
        setPendingQueue((currentQueue) => {
          const newQueue = [...currentQueue, notification];
          
          // Ordenar cola por prioridad también
          const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
          newQueue.sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
          );

          return newQueue;
        });

        return currentNotifications;
      }
    });

    return notification.id;
  };

  const dismiss = async (id, reason = 'manual') => {
    // Buscar la notificación en las activas
    const notification = notifications.find(n => n.id === id);
    
    if (notification?.onDismiss) {
      notification.onDismiss(reason);
    }
    
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== id);
      
      // Después de remover, procesar la cola para liberar notificaciones pendientes
      setTimeout(() => {
        processQueue();
      }, 100); // Pequeño delay para evitar problemas de concurrencia
      
      return filtered;
    });

    // También remover de la cola si está allí
    setPendingQueue((prev) => prev.filter((n) => n.id !== id));
  };

  // Nueva función para cerrar por source (más confiable)
  const dismissBySource = (source, reason = 'manual') => {
    let found = false;
    
    setNotifications((prev) => {
      const filtered = prev.filter((n) => {
        if (n.source === source) {
          found = true;
          // Llamar onDismiss si existe
          if (n.onDismiss) {
            n.onDismiss(reason);
          }
          return false; // Remover esta notificación
        }
        return true; // Mantener las demás
      });
      
      return filtered;
    });

    // También remover de la cola
    setPendingQueue((prev) => prev.filter((n) => n.source !== source));
    
    return found;
  };

  const dismissAll = () => {
    setNotifications([]);
    setPendingQueue([]);
  };

  const handleNavigate = (navigation) => {
    if (navigation && onNavigate) {
      onNavigate(navigation);
    }
  };

  // API simple con funciones para marcar resolución
  const pushNotification = {
    show,
    
    // Shortcuts por tipo (usan duration desde configuración por defecto)
    info: (title, message, options = {}) => 
      show({ title, message, type: "info", ...options }),
      
    success: (title, message, options = {}) => 
      show({ title, message, type: "success", ...options }),
      
    warning: (title, message, options = {}) => 
      show({ title, message, type: "warning", ...options }),
      
    error: (title, message, options = {}) => 
      show({ title, message, type: "error", ...options }),
    
    // Notificación con navegación
    withNavigation: (title, message, screen, params = {}, options = {}) =>
      show({ 
        title, 
        message, 
        navigation: { screen, params },
        ...options 
      }),
    
    // ===== FUNCIONES SIMPLES PARA MANEJAR RESOLUCIÓN =====
    
    // Marcar fuente como resuelta (actualiza las notificaciones activas de esa fuente)
    markSourceAsResolved: (source) => {
      setNotifications(prev => prev.map(notification => {
        if (notification.source === source && !notification.isResolved) {
          // Llamar callback si existe
          if (notification.onSourceResolved) {
            notification.onSourceResolved(notification);
          }
          
          // Cambiar duración a 2 segundos para fuentes resueltas
          setTimeout(() => dismiss(notification.id, 'resolved'), 2000);
          
          return { ...notification, isResolved: true };
        }
        return notification;
      }));
    },
    
    // Marcar fuente como activa (aumenta duración de notificaciones de esa fuente)
    markSourceAsActive: (source) => {
      setNotifications(prev => prev.map(notification => {
        if (notification.source === source) {
          return { ...notification, isActiveSource: true };
        }
        return notification;
      }));
    },
    
    dismiss,
    dismissBySource, // Nueva función
    dismissAll,
    
    // Información de estado para debugging
    getStatus: () => ({
      active: notifications.length,
      pending: pendingQueue.length,
      maxNotifications,
      maxNotificationsByType,
      activeSources: notifications.filter(n => n.isActiveSource).length,
      resolvedSources: notifications.filter(n => n.isResolved).length,
      byType: notifications.reduce((acc, n) => {
        const key = `${n.type}-${n.source}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    }),
  };

  return (
    <PushNotificationContext.Provider value={pushNotification}>
      {children}
      <PushNotificationContainer 
        notifications={notifications} 
        onDismiss={dismiss}
        onNavigate={handleNavigate}
      />
    </PushNotificationContext.Provider>
  );
}

// ══════════════════════════════════════════════════════════════
//  usePushNotification Hook
// ══════════════════════════════════════════════════════════════

/**
 * usePushNotification - Hook para usar el sistema de notificaciones push
 * 
 * @returns {object} API de notificaciones push
 * 
 * @example
 * function MyComponent() {
 *   const pushNotification = usePushNotification();
 *   
 *   const handleNewAttendance = (student) => {
 *     pushNotification.success(
 *       "Asistencia registrada",
 *       `${student.name} ha sido registrado`,
 *       {
 *         duration: 8000,
 *         navigation: { screen: "Students", params: { studentId: student.id } },
 *         source: "facial-recognition",
 *         priority: "high"
 *       }
 *     );
 *   };
 * }
 */
export function usePushNotification() {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error("usePushNotification debe usarse dentro de PushNotificationProvider");
  }
  return context;
}

// ══════════════════════════════════════════════════════════════
//  Push Notification Container
// ══════════════════════════════════════════════════════════════

function PushNotificationContainer({ notifications, onDismiss, onNavigate }) {
  if (notifications.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {notifications.map((notification) => (
        <PushNotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />
      ))}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  Funciones de utilidad
// ══════════════════════════════════════════════════════════════

// Función para calcular colores según tiempo restante
const calculateColorsForTime = (seconds, themeColors) => {
  // 4 estados de color basados en la paleta del tema:
  // - Safe (> 90s): Azul (primary/info)
  // - Warning (60-90s): Amarillo (warning) 
  // - Critical (30-60s): Naranja (entre warning y error)
  // - Danger (<30s): Rojo (error/danger)
  
  if (seconds > 90) {
    // SAFE - Azul primario
    return {
      background: themeColors.brand.primaryLight || themeColors.status.infoLight,
      border: themeColors.brand.primary,
      progress: themeColors.brand.primary,
      text: themeColors.text.primary,
      timerBg: themeColors.brand.primary,
      timerText: themeColors.brand.textOnPrimary || themeColors.text.onBrand
    };
  } else if (seconds > 60) {
    // WARNING - Amarillo
    return {
      background: themeColors.status.warningLight,
      border: themeColors.status.warning,
      progress: themeColors.status.warning,
      text: themeColors.text.primary,
      timerBg: themeColors.status.warning,
      timerText: themeColors.status.warningText
    };
  } else if (seconds > 30) {
    // CRITICAL - Naranja (interpolación entre warning y error)
    const orangeColor = tinycolor.mix(themeColors.status.warning, themeColors.status.error, 50).toHexString();
    const orangeLight = tinycolor(orangeColor).lighten(30).toHexString();
    return {
      background: orangeLight,
      border: orangeColor,
      progress: orangeColor,
      text: themeColors.text.primary,
      timerBg: orangeColor,
      timerText: '#FFFFFF' // Texto blanco sobre naranja
    };
  } else {
    // DANGER - Rojo
    return {
      background: themeColors.status.errorLight,
      border: themeColors.status.error,
      progress: themeColors.status.error,
      text: themeColors.text.primary,
      timerBg: themeColors.status.error,
      timerText: themeColors.status.errorText
    };
  }
};

// ══════════════════════════════════════════════════════════════
//  Push Notification Item
// ══════════════════════════════════════════════════════════════

function PushNotificationItem({ notification, onDismiss, onNavigate }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [animation] = useState(new Animated.Value(0));
  const [progressAnim] = useState(new Animated.Value(1));
  
  const timerIntervalRef = useRef(null);

  // Verificar si tiene contador
  const showTimer = notification.data?.showTimer;
  const initialSeconds = notification.data?.initialTimeSeconds;
  
  // Estados para contador y colores dinámicos
  const initialTime = useMemo(() => showTimer && initialSeconds ? initialSeconds : 0, [showTimer, initialSeconds]);
  const initialColors = useMemo(() => showTimer ? calculateColorsForTime(initialTime, c) : {
    background: c.status.warningLight,
    border: c.status.warning,
    progress: c.status.warning,
    text: c.text.primary,
    timerBg: c.status.warning,
    timerText: c.status.warningText
  }, [showTimer, initialTime, c]);
  
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [currentColors, setCurrentColors] = useState(initialColors);

  useEffect(() => {
    // Animación de entrada
    Animated.spring(animation, {
      toValue: 1,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();

    // Configurar barra de progreso NORMAL
    if (notification.duration > 0) {
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: notification.duration,
        useNativeDriver: false,
      }).start();
    }
  }, [animation, progressAnim, notification.duration]);

  // Efecto para el timer (sin setState inicial)
  useEffect(() => {
    if (showTimer && initialSeconds && notification.duration > 0) {
      let currentTime = initialSeconds;
      
      timerIntervalRef.current = setInterval(() => {
        currentTime--;
        setTimeLeft(Math.max(0, currentTime));
        
        // Actualizar colores de toda la push según tiempo restante
        setCurrentColors(calculateColorsForTime(currentTime, c));
        
        if (currentTime <= 0) {
          clearInterval(timerIntervalRef.current);
        }
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [showTimer, initialSeconds, notification.duration, c]);

  const handleDismiss = (reason = 'manual') => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    Animated.timing(animation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss(notification.id, reason);
    });
  };

  const handlePress = () => {
    if (notification.onPress) {
      notification.onPress(notification);
    } else if (notification.navigation) {
      onNavigate(notification.navigation);
    }
    handleDismiss('press');
  };

  // Formatear tiempo para el contador
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Configuración por tipo (colores base)
  const typeConfig = {
    success: {
      icon: "check-circle",
      bgColor: c.status.successLight || c.status.success + "15",
      iconColor: c.status.success,
      textColor: getContrastTextColor(c.status.successLight || c.status.success + "15"),
      borderColor: c.status.success,
    },
    error: {
      icon: "alert-circle", 
      bgColor: c.status.dangerLight || c.status.danger + "15",
      iconColor: c.status.danger,
      textColor: getContrastTextColor(c.status.dangerLight || c.status.danger + "15"),
      borderColor: c.status.danger,
    },
    warning: {
      icon: "alert-triangle",
      bgColor: c.status.warningLight || c.status.warning + "15",
      iconColor: c.status.warning,
      textColor: getContrastTextColor(c.status.warningLight || c.status.warning + "15"),
      borderColor: c.status.warning,
    },
    info: {
      icon: "info",
      bgColor: c.status.infoLight || c.brand.primaryLight || c.brand.primary + "15",
      iconColor: c.brand.primary,
      textColor: getContrastTextColor(c.status.infoLight || c.brand.primaryLight || c.brand.primary + "15"),
      borderColor: c.brand.primary,
    },
    custom: {
      icon: "bell",
      bgColor: c.background.surface,
      iconColor: c.text.primary,
      textColor: c.text.primary,
      borderColor: c.border.primary,
    },
  };

  // Configuración final: usar colores dinámicos si tiene timer, sino colores base
  let config = typeConfig[notification.type] || typeConfig.info;
  
  // OVERRIDE: Si tiene timer, usar colores dinámicos que cambian con el tiempo
  if (showTimer) {
    config = {
      ...config,
      bgColor: currentColors.background,
      borderColor: currentColors.border,
      iconColor: currentColors.border,
      textColor: currentColors.text,
    };
  }
  
  const displayIcon = notification.icon || config.icon;

  // Transform para entrada
  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  const opacity = animation;

  // Width de la barra de progreso
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const isPressable = !!(notification.onPress || notification.navigation);

  return (
    <Animated.View
      style={[
        styles.notification,
        {
          backgroundColor: config.bgColor,
          borderLeftColor: config.borderColor,
          transform: [{ translateX }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.notificationContent}
        onPress={handlePress}
        disabled={!isPressable}
        activeOpacity={isPressable ? 0.7 : 1}
      >
        {/* Icono principal */}
        <View style={[styles.iconContainer, { backgroundColor: config.iconColor + "20" }]}>
          <Feather name={displayIcon} size={22} color={config.iconColor} />
        </View>

        {/* Contenido */}
        <View style={styles.contentContainer}>
          {/* Título y badges */}
          <View style={styles.headerRow}>
            <Text
              style={[styles.title, { color: config.textColor }]}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            
            {/* Mini contador (solo si showTimer es true) */}
            {showTimer && (
              <View style={[styles.timerBadge, { backgroundColor: currentColors.timerBg }]}>
                <Text style={[styles.timerText, { color: currentColors.timerText }]}>
                  {formatTime(timeLeft)}
                </Text>
              </View>
            )}
            
            {/* Badges normales */}
            {notification.isActiveSource && !showTimer && (
              <View style={[styles.badge, { backgroundColor: c.status.warning + "20" }]}>
                <Feather name="clock" size={10} color={c.status.warning} />
                <Text style={[styles.badgeText, { color: c.status.warning }]}>
                  Activa
                </Text>
              </View>
            )}
            
            {notification.isResolved && (
              <View style={[styles.badge, { backgroundColor: c.status.success + "20" }]}>
                <Feather name="check" size={10} color={c.status.success} />
                <Text style={[styles.badgeText, { color: c.status.success }]}>
                  Resuelta
                </Text>
              </View>
            )}
            
            {notification.wasQueued && (
              <View style={[styles.badge, { backgroundColor: config.iconColor + "15" }]}>
                <Text style={[styles.badgeText, { color: config.iconColor }]}>
                  +{notification.queuePosition}
                </Text>
              </View>
            )}
            
            {notification.source && notification.source !== "system" && !showTimer && (
              <View style={[styles.badge, { backgroundColor: config.iconColor + "20" }]}>
                <Text style={[styles.badgeText, { color: config.iconColor }]}>
                  {notification.source}
                </Text>
              </View>
            )}
          </View>

          {/* Mensaje */}
          <Text
            style={[styles.message, { color: config.textColor }]}
            numberOfLines={2}
          >
            {notification.message}
          </Text>

          {/* NO ACTION BUTTONS - Solo auto-dismiss */}

          {/* NO NAVIGATION INDICATORS - Solo notificación básica */}
        </View>

        {/* Botón de cerrar */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={18} color={config.textColor} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Barra de progreso NORMAL con colores dinámicos */}
      {notification.duration > 0 && (
        <Animated.View
          style={[
            styles.progressBar,
            {
              backgroundColor: showTimer ? currentColors.progress : config.iconColor,
              width: progressWidth,
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════
//  Styles
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "web" ? 20 : 60,
    right: Platform.OS === "web" ? 20 : 16,
    width: Platform.OS === "web" ? 420 : "90%",
    maxWidth: 420,
    zIndex: 99999,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  notification: {
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  notificationContent: {
    flexDirection: "row",
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: DESIGN_TOKENS.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  // Removed actionButton styles - no action buttons needed
  navigationHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  navigationText: {
    fontSize: 11,
    fontWeight: "500",
  },
  closeButton: {
    padding: 4,
  },
  progressBar: {
    height: 3,
    position: "absolute",
    bottom: 0,
    left: 0,
  },
  timerBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

// ══════════════════════════════════════════════════════════════
//  Exports
// ══════════════════════════════════════════════════════════════

export default { PushNotificationProvider, usePushNotification };
