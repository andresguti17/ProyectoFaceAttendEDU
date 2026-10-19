import React from "react";
import { DatePicker } from "./DatePicker";
import { formatTime } from "../../../../core/constants/dateFormats";

/**
 * TimePicker component para selección de hora
 * 
 * Wrapper de DatePicker en mode='time'. Proporciona una API específica
 * para selección de horas con formato optimizado según configuración institucional.
 * 
 * @param {Date} value - Hora seleccionada
 * @param {function} onChange - Callback al cambiar hora
 * @param {string} label - Etiqueta
 * @param {string} placeholder - Placeholder
 * @param {boolean} error - Si hay error
 * @param {string} errorMessage - Mensaje de error
 * @param {boolean} disabled - Si está deshabilitado
 * @param {boolean} required - Si es requerido
 * 
 * @example
 * // TimePicker básico
 * const [startTime, setStartTime] = useState(new Date());
 * <TimePicker
 *   label="Hora de inicio"
 *   value={startTime}
 *   onChange={setStartTime}
 * />
 * 
 * @example
 * // Horario de clase
 * <View>
 *   <TimePicker
 *     label="Hora de inicio"
 *     value={startTime}
 *     onChange={setStartTime}
 *   />
 *   <TimePicker
 *     label="Hora de fin"
 *     value={endTime}
 *     onChange={setEndTime}
 *   />
 * </View>
 */
export function TimePicker({
  value,
  onChange,
  label,
  placeholder = "Seleccionar hora",
  error,
  errorMessage,
  disabled,
  required,
  style,
}) {
  // Override placeholder para mostrar formato de hora según configuración (24h o 12h AM/PM)
  const timePlaceholder = value ? formatTime(value) : placeholder;

  return (
    <DatePicker
      mode="time"
      value={value}
      onChange={onChange}
      label={label}
      placeholder={timePlaceholder}
      error={error}
      errorMessage={errorMessage}
      disabled={disabled}
      required={required}
      style={style}
    />
  );
}

export default TimePicker;
