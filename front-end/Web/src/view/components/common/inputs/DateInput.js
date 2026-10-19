// ============================================================
//  DateInput — Input de fecha con formateo automático
// ============================================================
//  Input especializado que:
//  - Solo acepta números
//  - Aplica el formato configurado en Settings (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
//  - Agrega separadores automáticamente
//  - Valida la fecha mientras se escribe
// ============================================================

import React, { useState, useCallback, useEffect } from "react";
import { TextInput } from "./TextInput";
import { useDateFormat } from "../../hooks/useDateFormat";

/**
 * Obtiene el número de días en un mes específico
 * @param {number} month - Mes (1-12)
 * @param {number} year - Año completo (ej: 2025)
 * @returns {number} Número de días en el mes
 */
function getDaysInMonth(month, year) {
    // Si no hay año o mes inválido, retornar 31 por defecto
    if (!month || month < 1 || month > 12) return 31;
    
    // Si hay año, calcular días exactos (incluye años bisiestos)
    if (year && year >= 1000) {
        return new Date(year, month, 0).getDate();
    }
    
    // Sin año completo, usar valores estándar
    const daysInMonth = {
        1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
        7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
    };
    
    return daysInMonth[month] || 31;
}

/**
 * Valida y corrige un componente de fecha
 * @param {string} value - Valor del componente (día, mes o año)
 * @param {string} type - Tipo: 'day' | 'month' | 'year'
 * @param {number} month - Mes actual (para validar días)
 * @param {number} year - Año actual (para validar días en febrero)
 * @returns {string} Valor validado y corregido
 */
function validateDateComponent(value, type, month = null, year = null) {
    if (!value) return value;
    
    const num = parseInt(value, 10);
    
    if (type === 'day') {
        const maxDays = getDaysInMonth(month, year);
        if (num > maxDays) {
            return String(maxDays).padStart(2, '0');
        }
        if (num < 1) return '01';
        return value;
    }
    
    if (type === 'month') {
        if (num > 12) return '12';
        if (num < 1) return '01';
        return value;
    }
    
    if (type === 'year') {
        // Permitir escribir el año libremente hasta 4 dígitos
        return value.slice(0, 4);
    }
    
    return value;
}

/**
 * Formatea el valor según el formato configurado CON VALIDACIÓN
 * @param {string} value - Valor sin formato (solo números)
 * @param {string} format - Formato: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
 * @returns {string} Valor formateado con separadores y validado
 */
function formatDateValue(value, format) {
    // Eliminar todo excepto números
    const numbers = value.replace(/\D/g, '');
    
    if (!numbers) return '';
    
    let day = '', month = '', year = '';
    let formatted = '';
    
    if (format === 'YYYY-MM-DD') {
        // YYYY-MM-DD
        year = numbers.slice(0, 4);
        month = numbers.slice(4, 6);
        day = numbers.slice(6, 8);
        
        // Validar mes
        if (month) {
            month = validateDateComponent(month, 'month');
        }
        
        // Validar día
        if (day) {
            day = validateDateComponent(day, 'day', parseInt(month, 10), parseInt(year, 10));
        }
        
        if (numbers.length <= 4) {
            formatted = year;
        } else if (numbers.length <= 6) {
            formatted = `${year}-${month}`;
        } else {
            formatted = `${year}-${month}-${day}`;
        }
    } else if (format === 'MM/DD/YYYY') {
        // MM/DD/YYYY
        month = numbers.slice(0, 2);
        day = numbers.slice(2, 4);
        year = numbers.slice(4, 8);
        
        // Validar mes
        if (month) {
            month = validateDateComponent(month, 'month');
        }
        
        // Validar día
        if (day) {
            day = validateDateComponent(day, 'day', parseInt(month, 10), parseInt(year, 10));
        }
        
        if (numbers.length <= 2) {
            formatted = month;
        } else if (numbers.length <= 4) {
            formatted = `${month}/${day}`;
        } else {
            formatted = `${month}/${day}/${year}`;
        }
    } else {
        // DD/MM/YYYY (default)
        day = numbers.slice(0, 2);
        month = numbers.slice(2, 4);
        year = numbers.slice(4, 8);
        
        // Validar mes
        if (month) {
            month = validateDateComponent(month, 'month');
        }
        
        // Validar día
        if (day) {
            day = validateDateComponent(day, 'day', parseInt(month, 10), parseInt(year, 10));
        }
        
        if (numbers.length <= 2) {
            formatted = day;
        } else if (numbers.length <= 4) {
            formatted = `${day}/${month}`;
        } else {
            formatted = `${day}/${month}/${year}`;
        }
    }
    
    return formatted;
}

/**
 * Convierte formato configurado a formato interno YYYY-MM-DD
 * @param {string} formatted - Fecha formateada según settings
 * @param {string} format - Formato: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
 * @returns {string} Fecha en formato YYYY-MM-DD o vacío si inválida
 */
function toInternalFormat(formatted, format) {
    if (!formatted) return '';
    
    // Extraer solo números
    const numbers = formatted.replace(/\D/g, '');
    
    if (numbers.length !== 8) return ''; // Debe tener 8 dígitos
    
    let year, month, day;
    
    if (format === 'YYYY-MM-DD') {
        year = numbers.slice(0, 4);
        month = numbers.slice(4, 6);
        day = numbers.slice(6, 8);
    } else if (format === 'MM/DD/YYYY') {
        month = numbers.slice(0, 2);
        day = numbers.slice(2, 4);
        year = numbers.slice(4, 8);
    } else { // DD/MM/YYYY
        day = numbers.slice(0, 2);
        month = numbers.slice(2, 4);
        year = numbers.slice(4, 8);
    }
    
    return `${year}-${month}-${day}`;
}

/**
 * Convierte formato interno YYYY-MM-DD a formato configurado
 * @param {string} internal - Fecha en formato YYYY-MM-DD
 * @param {string} format - Formato: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
 * @returns {string} Fecha formateada según settings
 */
function fromInternalFormat(internal, format) {
    if (!internal || internal.length !== 10) return '';
    
    const [year, month, day] = internal.split('-');
    
    if (format === 'YYYY-MM-DD') {
        return `${year}-${month}-${day}`;
    } else if (format === 'MM/DD/YYYY') {
        return `${month}/${day}/${year}`;
    } else { // DD/MM/YYYY
        return `${day}/${month}/${year}`;
    }
}

/**
 * Valida si una fecha es válida
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @returns {boolean} True si es válida
 */
function isValidDate(dateStr) {
    if (!dateStr || dateStr.length !== 10) return false;
    
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
}

/**
 * Componente DateInput con formateo automático
 */
export function DateInput({
    value, // Valor en formato YYYY-MM-DD (formato interno)
    onChangeText, // Callback que recibe formato YYYY-MM-DD
    label,
    placeholder,
    required = false,
    error = false,
    errorMessage,
    leftIcon,
    ...props
}) {
    const { dateFormat } = useDateFormat();
    
    // Estado local para el valor formateado (lo que ve el usuario)
    const [displayValue, setDisplayValue] = useState(() => {
        return value ? fromInternalFormat(value, dateFormat) : '';
    });
    
    // Ref para detectar si el cambio viene del usuario o del prop
    const isUserInputRef = React.useRef(false);
    
    // Actualizar displayValue SOLO cuando cambia el value prop externamente (no por input del usuario)
    useEffect(() => {
        // Solo actualizar si NO es un cambio iniciado por el usuario
        if (!isUserInputRef.current) {
            if (value) {
                setDisplayValue(fromInternalFormat(value, dateFormat));
            } else {
                setDisplayValue('');
            }
        }
        // Resetear el flag después de cada actualización
        isUserInputRef.current = false;
    }, [value, dateFormat]);
    
    // Manejar cambios en el input
    const handleChange = useCallback((text) => {
        // Marcar que este cambio viene del usuario
        isUserInputRef.current = true;
        
        // Formatear el texto según la configuración
        const formatted = formatDateValue(text, dateFormat);
        setDisplayValue(formatted);
        
        // Convertir a formato interno y notificar al padre
        const internal = toInternalFormat(formatted, dateFormat);
        
        // Notificar siempre al padre con el valor actual
        onChangeText(internal);
    }, [dateFormat, onChangeText]);
    
    // Determinar el placeholder según el formato
    const getPlaceholder = () => {
        if (placeholder) return placeholder;
        
        if (dateFormat === 'YYYY-MM-DD') {
            return 'AAAA-MM-DD';
        } else if (dateFormat === 'MM/DD/YYYY') {
            return 'MM/DD/AAAA';
        } else {
            return 'DD/MM/AAAA';
        }
    };
    
    return (
        <TextInput
            {...props}
            label={label}
            value={displayValue}
            onChangeText={handleChange}
            placeholder={getPlaceholder()}
            required={required}
            error={error}
            errorMessage={errorMessage}
            leftIcon={leftIcon}
            type="text"
            maxLength={10} // DD/MM/YYYY = 10 caracteres
        />
    );
}

export default DateInput;
