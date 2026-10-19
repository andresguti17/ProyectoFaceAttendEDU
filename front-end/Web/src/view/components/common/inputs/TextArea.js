import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { TextInput } from "./TextInput";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * TextArea - Input multilinea dedicado para textos largos
 * 
 * Componente especializado que extiende TextInput para textos multilinea.
 * Incluye contador de caracteres opcional y mejor UX para texto largo.
 * 
 * @param {string} value - Valor del textarea
 * @param {function} onChangeText - Callback al cambiar texto
 * @param {string} label - Etiqueta
 * @param {string} placeholder - Placeholder
 * @param {number} rows - Número de filas visibles (default: 4)
 * @param {number} maxLength - Máximo de caracteres permitidos
 * @param {boolean} showCount - Mostrar contador de caracteres (default: true si maxLength)
 * @param {boolean} error - Si hay error
 * @param {string} errorMessage - Mensaje de error
 * @param {boolean} disabled - Si está deshabilitado
 * @param {boolean} required - Si es requerido
 * @param {object} ...props - Todas las props de TextInput
 * 
 * @example
 * // TextArea básico
 * const [description, setDescription] = useState("");
 * <TextArea
 *   label="Descripción"
 *   value={description}
 *   onChangeText={setDescription}
 *   placeholder="Escribe una descripción..."
 * />
 * 
 * @example
 * // Con límite de caracteres
 * <TextArea
 *   label="Comentario"
 *   value={comment}
 *   onChangeText={setComment}
 *   maxLength={500}
 *   rows={5}
 * />
 * 
 * @example
 * // Con contador visible siempre
 * <TextArea
 *   label="Nota"
 *   value={note}
 *   onChangeText={setNote}
 *   showCount
 * />
 * 
 * @example
 * // Con error
 * <TextArea
 *   label="Observaciones"
 *   value={observations}
 *   onChangeText={setObservations}
 *   required
 *   error={!observations}
 *   errorMessage="Las observaciones son requeridas"
 * />
 * 
 * @example
 * // Formulario completo
 * <View>
 *   <TextInput
 *     label="Título"
 *     value={title}
 *     onChangeText={setTitle}
 *   />
 *   <TextArea
 *     label="Descripción"
 *     value={description}
 *     onChangeText={setDescription}
 *     maxLength={1000}
 *     rows={6}
 *     placeholder="Describe el problema o sugerencia..."
 *   />
 * </View>
 */
export function TextArea({
  value = "",
  onChangeText,
  label,
  placeholder,
  rows = 4,
  maxLength,
  showCount,
  error,
  errorMessage,
  disabled,
  required,
  style,
  ...props
}) {
  const { theme } = useTheme();

  // Mostrar contador si maxLength está definido o showCount es true
  const shouldShowCount = maxLength !== undefined || showCount;

  const characterCount = value.length;
  const countText = maxLength
    ? `${characterCount}/${maxLength}`
    : `${characterCount}`;

  // Calcular altura aproximada basada en rows
  const minHeight = rows * 20 + 32; // ~20px por línea + padding

  return (
    <View style={style}>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        numberOfLines={rows}
        maxLength={maxLength}
        error={error}
        errorMessage={errorMessage}
        disabled={disabled}
        required={required}
        inputStyle={{ minHeight, textAlignVertical: "top" }}
        {...props}
      />

      {shouldShowCount && !error && (
        <Text
          style={[
            styles.counter,
            {
              color:
                maxLength && characterCount > maxLength * 0.9
                  ? theme.colors.status.warning
                  : theme.colors.text.secondary,
            },
          ]}
        >
          {countText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    fontSize: 11,
    textAlign: "right",
    marginTop: -DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
});

export default TextArea;
