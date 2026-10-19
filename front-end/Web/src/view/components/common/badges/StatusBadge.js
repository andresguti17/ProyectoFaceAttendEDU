import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Badge } from "./Badge";
import { useTheme } from "../../hooks/useTheme";
import { getAttendanceThresholds } from "../../../../models/data/userDerivedData";

/**
 * Badge para mostrar estados con umbrales genéricos
 * Útil para progreso, calificaciones, etc. (NO para asistencia)
 * Para asistencia usa AttendanceBadge o useAttendanceStatus
 */
export function StatusBadge({
  value,
  thresholds,
  showIcon = false,
  suffix = "%",
  size = "md",
  style,
}) {
  const { theme } = useTheme();

  // Determinar variante según umbrales
  let variant = "danger";
  let icon = "⚠";

  if (value >= thresholds.excellent) {
    variant = "success";
    icon = "✓";
  } else if (value >= thresholds.good) {
    variant = "info";
    icon = "→";
  } else if (value >= thresholds.warning) {
    variant = "warning";
    icon = "!";
  }

  return (
    <Badge variant={variant} size={size} style={style}>
      {showIcon && `${icon} `}
      {value}{suffix}
    </Badge>
  );
}

/**
 * Badge específico para asistencia - Usa configuración dinámica
 */
export function AttendanceBadge({ attendance, showIcon = false, size = "md" }) {
  const status = useAttendanceStatus(attendance);
  
  const variantMap = {
    excellent: "success",
    warning: "warning",
    danger: "danger",
    inactive: "default",
  };

  return (
    <Badge variant={variantMap[status.level]} size={size}>
      {showIcon && status.level !== "inactive" && `${status.level === "excellent" ? "✓" : status.level === "warning" ? "!" : "⚠"} `}
      {attendance}%
    </Badge>
  );
}

/**
 * Badge para estados de asistencia (on_time, late, absent)
 */
export function AttendanceStatusBadge({ status, label }) {
  const variantMap = {
    on_time: "success",
    late: "warning",
    absent: "danger",
    present: "success",
  };

  const labelMap = {
    on_time: "A tiempo",
    late: "Tardanza",
    absent: "Ausente",
    present: "Presente",
  };

  return (
    <Badge variant={variantMap[status] || "default"}>
      {label || labelMap[status] || status}
    </Badge>
  );
}

export default StatusBadge;

// ═══════════════════════════════════════════════════════════
// HOOKS DE ASISTENCIA - Usan configuración dinámica
// ═══════════════════════════════════════════════════════════

/**
 * Hook para obtener el estado completo de asistencia (DINÁMICO)
 * Única fuente de verdad para colores de asistencia
 */
export function useAttendanceStatus(attendance, isActive = true) {
  const { theme } = useTheme();
  const c = theme.colors;
  
  // Obtener umbrales dinámicos de configuración
  const thresholds = getAttendanceThresholds();
  
  if (!isActive) {
    return {
      color: c.text.disabled,
      bgColor: c.background.secondary,
      level: "inactive",
      label: "Inactivo"
    };
  }
  
  // Lógica simplificada de 3 niveles:
  // 1. EXCELLENT (verde): >= warning (ej: >= 82%)
  // 2. WARNING (ámbar): >= minAttendance pero < warning (ej: 80-82%)
  // 3. DANGER (rojo): < minAttendance (ej: < 80%)
  
  if (attendance >= thresholds.excellent) {
    // Por encima del warning threshold → EXCELLENT (verde)
    return {
      color: c.status.success,
      bgColor: c.status.successLight || "#ECFDF5",
      level: "excellent",
      label: "Excelente"
    };
  } else if (attendance >= thresholds.warning ) {
    // Entre mínimo y warning → WARNING (ámbar)
    return {
      color: c.status.warning,
      bgColor: c.status.warningLight || "#FFFBEB",
      level: "warning", 
      label: "Aceptable"
    };
  } else {
    // Por debajo del mínimo → DANGER (rojo)
    return {
      color: c.status.danger,
      bgColor: c.status.dangerLight || "#FEF2F2",
      level: "danger",
      label: "En riesgo"
    };
  }
}

/**
 * Hook para obtener solo el color de asistencia (DINÁMICO)
 * Usa useAttendanceStatus internamente
 */
export function useAttendanceColor(attendance) {
  const status = useAttendanceStatus(attendance);
  return status.color;
}

/**
 * Icono circular para estado de asistencia (on_time, late, absent, present)
 */
export function AttendanceStatusIcon({ status, size = 32 }) {
  const { theme } = useTheme();
  
  const configMap = {
    on_time: {
      icon: "check",
      backgroundColor: theme.colors.status.success,
      color: "#FFFFFF",
    },
    present: {
      icon: "check",
      backgroundColor: theme.colors.status.success,
      color: "#FFFFFF",
    },
    late: {
      icon: "clock",
      backgroundColor: theme.colors.status.warning,
      color: "#FFFFFF",
    },
    absent: {
      icon: "x",
      backgroundColor: theme.colors.status.danger,
      color: "#FFFFFF",
    },
  };

  const config = configMap[status] || {
    icon: "help-circle",
    backgroundColor: theme.colors.border.primary,
    color: theme.colors.text.secondary,
  };

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: config.backgroundColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name={config.icon} size={size * 0.5} color={config.color} />
    </View>
  );
}
