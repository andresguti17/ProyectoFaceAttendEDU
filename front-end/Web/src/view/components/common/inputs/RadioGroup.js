import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Radio } from "./Radio";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * RadioGroup - Grupo de radio buttons para selección única
 * 
 * Componente que agrupa múltiples opciones de radio buttons y maneja la selección única automáticamente.
 * Simplifica el manejo de estado y garantiza que solo una opción esté seleccionada a la vez.
 * 
 * @param {string} value - Valor seleccionado actualmente
 * @param {function} onValueChange - Callback al cambiar selección (recibe nuevo valor)
 * @param {Array<{value: string, label: string, description?: string, disabled?: boolean}>} options - Array de opciones
 * @param {string} label - Label del grupo
 * @param {('default'|'primary'|'success'|'warning'|'danger')} variant - Variante visual
 * @param {('sm'|'md'|'lg')} size - Tamaño de los radios
 * @param {('vertical'|'horizontal')} layout - Orientación del grupo
 * @param {boolean} disabled - Si todo el grupo está deshabilitado
 * @param {boolean} error - Si hay error
 * @param {string} errorMessage - Mensaje de error
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // RadioGroup básico
 * <RadioGroup 
 *   value={gender}
 *   onValueChange={setGender}
 *   options={[
 *     { value: 'male', label: 'Masculino' },
 *     { value: 'female', label: 'Femenino' },
 *     { value: 'other', label: 'Otro' }
 *   ]}
 * />
 * 
 * @example
 * // RadioGroup con label y descripciones
 * <RadioGroup 
 *   label="Selecciona tu plan"
 *   value={plan}
 *   onValueChange={setPlan}
 *   options={[
 *     { 
 *       value: 'free', 
 *       label: 'Gratis',
 *       description: 'Funcionalidades básicas'
 *     },
 *     { 
 *       value: 'premium', 
 *       label: 'Premium',
 *       description: 'Todas las funcionalidades - $9.99/mes'
 *     }
 *   ]}
 * />
 * 
 * @example
 * // RadioGroup horizontal
 * <RadioGroup 
 *   value={priority}
 *   onValueChange={setPriority}
 *   layout="horizontal"
 *   options={[
 *     { value: 'low', label: 'Baja' },
 *     { value: 'medium', label: 'Media' },
 *     { value: 'high', label: 'Alta' }
 *   ]}
 * />
 * 
 * @example
 * // RadioGroup con error
 * <RadioGroup 
 *   label="Rol del usuario"
 *   value={role}
 *   onValueChange={setRole}
 *   options={[
 *     { value: 'student', label: 'Estudiante' },
 *     { value: 'teacher', label: 'Docente' },
 *     { value: 'admin', label: 'Administrador' }
 *   ]}
 *   error={submitted && !role}
 *   errorMessage="Debes seleccionar un rol"
 * />
 */
export function RadioGroup({
  value,
  onValueChange,
  options = [],
  label,
  variant = "default",
  size = "md",
  layout = "vertical",
  disabled = false,
  error = false,
  errorMessage,
  style,
  ...props
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const isHorizontal = layout === "horizontal";

  return (
    <View style={[styles.container, style]} {...props}>
      {/* Label del grupo */}
      {label && (
        <Text
          style={[
            styles.groupLabel,
            {
              color: error ? c.status.danger : c.text.primary,
              fontSize: 14,
              fontWeight: "600",
              marginBottom: DESIGN_TOKENS.spacing.sm,
            },
          ]}
        >
          {label}
        </Text>
      )}

      {/* Opciones */}
      <View
        style={[
          styles.optionsContainer,
          isHorizontal && styles.horizontalContainer,
        ]}
      >
        {options.map((option, index) => (
          <View
            key={option.value}
            style={[
              isHorizontal && styles.horizontalItem,
              isHorizontal && index < options.length - 1 && styles.horizontalItemMargin,
            ]}
          >
            <Radio
              selected={value === option.value}
              onPress={() => {
                if (!disabled && !option.disabled && onValueChange) {
                  onValueChange(option.value);
                }
              }}
              label={option.label}
              description={option.description}
              variant={variant}
              size={size}
              disabled={disabled || option.disabled}
              error={error}
            />
          </View>
        ))}
      </View>

      {/* Error message */}
      {error && errorMessage && (
        <Text
          style={[
            styles.errorMessage,
            {
              fontSize: 13,
              color: c.status.danger,
              marginTop: DESIGN_TOKENS.spacing.xs,
            },
          ]}
        >
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: DESIGN_TOKENS.spacing.sm,
  },
  groupLabel: {
    lineHeight: 20,
  },
  optionsContainer: {
    // Vertical by default
  },
  horizontalContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  horizontalItem: {
    // Cada item en horizontal
  },
  horizontalItemMargin: {
    marginRight: DESIGN_TOKENS.spacing.lg,
  },
  errorMessage: {
    lineHeight: 18,
  },
});

export default RadioGroup;
