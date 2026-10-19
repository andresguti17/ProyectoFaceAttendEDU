/**
 * Funciones de validación reutilizables
 */

import { 
  validatePassword, 
  getPasswordStrength, 
  getPasswordStrengthLevel,
  getPasswordSuggestions 
} from "./passwordValidation";

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean} true si el email es válido
 * @example
 * isValidEmail("user@example.com") // true
 * isValidEmail("invalid") // false
 */
export function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida que un valor no esté vacío
 * @param {*} value - Valor a validar
 * @returns {boolean} true si el valor no está vacío
 * @example
 * isRequired("hello") // true
 * isRequired("") // false
 * isRequired(null) // false
 */
export function isRequired(value) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

/**
 * Valida longitud mínima de un valor
 * @param {string|number} value - Valor a validar
 * @param {number} min - Longitud mínima requerida
 * @returns {boolean} true si cumple con la longitud mínima
 * @example
 * minLength("hello", 3) // true
 * minLength("hi", 5) // false
 */
export function minLength(value, min) {
  if (!value) return false;
  return value.toString().length >= min;
}

/**
 * Valida longitud máxima de un valor
 * @param {string|number} value - Valor a validar
 * @param {number} max - Longitud máxima permitida
 * @returns {boolean} true si cumple con la longitud máxima
 * @example
 * maxLength("hello", 10) // true
 * maxLength("hello world", 5) // false
 */
export function maxLength(value, max) {
  if (!value) return true;
  return value.toString().length <= max;
}

/**
 * Valida que un valor sea numérico
 * @param {*} value - Valor a validar
 * @returns {boolean} true si es un número válido
 * @example
 * isNumber(42) // true
 * isNumber("42") // true
 * isNumber("hello") // false
 */
export function isNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * Valida que un número esté dentro de un rango
 * @param {number|string} value - Valor a validar
 * @param {number} min - Valor mínimo del rango
 * @param {number} max - Valor máximo del rango
 * @returns {boolean} true si está dentro del rango
 * @example
 * isInRange(5, 1, 10) // true
 * isInRange(15, 1, 10) // false
 */
export function isInRange(value, min, max) {
  const num = parseFloat(value);
  return isNumber(num) && num >= min && num <= max;
}

/**
 * Valida formato de URL
 * @param {string} url - URL a validar
 * @returns {boolean} true si la URL es válida
 * @example
 * isValidUrl("https://example.com") // true
 * isValidUrl("not a url") // false
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Valida formato de teléfono (internacional)
 * @param {string} phone - Número de teléfono a validar
 * @returns {boolean} true si el teléfono es válido
 * @example
 * isValidPhone("+1 (555) 123-4567") // true
 * isValidPhone("123") // false
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
}

/**
 * Valida formato de fecha
 * @param {string|Date} dateString - Fecha a validar
 * @returns {boolean} true si la fecha es válida
 * @example
 * isValidDate("2026-09-03") // true
 * isValidDate("03/09/2026") // true
 * isValidDate("invalid") // false
 */
export function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Valida que una persona sea mayor de edad (18+)
 * @param {string|Date} birthDate - Fecha de nacimiento
 * @returns {boolean} true si es mayor de 18 años
 * @example
 * isAdult("2000-01-01") // true
 * isAdult("2020-01-01") // false
 */
export function isAdult(birthDate) {
  if (!isValidDate(birthDate)) return false;
  const today = new Date();
  const birth = new Date(birthDate);
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    return age - 1 >= 18;
  }
  return age >= 18;
}

/**
 * Valida contraseña segura delegando a passwordValidation.js
 * @param {string} password - Contraseña a validar
 * @param {Object} userInfo - Información del usuario (opcional)
 * @returns {boolean} true si la contraseña es segura
 * @example
 * isStrongPassword("MyS3cur3P@ss!") // true
 * isStrongPassword("weak") // false
 * isStrongPassword("password123", { username: "john", email: "john@example.com" }) // false si usa info del usuario
 */
export function isStrongPassword(password, userInfo = {}) {
  const validation = validatePassword(password, userInfo);
  return validation.isValid;
}

/**
 * Valida contraseña y retorna resultados detallados
 * @param {string} password - Contraseña a validar
 * @param {Object} userInfo - Información del usuario (opcional)
 * @returns {{isValid: boolean, errors: string[], strength: number, level: string}} Resultado detallado
 * @example
 * const result = validatePasswordDetailed("MyP@ss123", { username: "john" });
 * // result = { isValid: true, errors: [], strength: 85, level: "Fuerte" }
 */
export function validatePasswordDetailed(password, userInfo = {}) {
  const validation = validatePassword(password, userInfo);
  const strength = getPasswordStrength(password);
  const { level } = getPasswordStrengthLevel(strength);
  
  return {
    isValid: validation.isValid,
    errors: validation.errors,
    strength,
    level,
  };
}

// Re-exportar funciones útiles de passwordValidation para acceso directo
export { 
  validatePassword as checkPassword,
  getPasswordStrength,
  getPasswordStrengthLevel,
  getPasswordSuggestions,
};

/**
 * Valida código de estudiante (letras y números, 6-12 caracteres)
 * @param {string} code - Código de estudiante a validar
 * @returns {boolean} true si el código es válido
 * @example
 * isValidStudentCode("ABC12345") // true
 * isValidStudentCode("12") // false (muy corto)
 * isValidStudentCode("ABC-123") // false (contiene guión)
 */
export function isValidStudentCode(code) {
  if (!code) return false;
  const codeRegex = /^[A-Za-z0-9]{6,12}$/;
  return codeRegex.test(code);
}

/**
 * Valida tamaño de archivo
 * @param {File} file - Archivo a validar
 * @param {number} maxSizeInMB - Tamaño máximo en megabytes
 * @returns {boolean} true si el archivo no excede el tamaño máximo
 * @example
 * isValidFileSize(file, 5) // true si file.size <= 5MB
 */
export function isValidFileSize(file, maxSizeInMB) {
  if (!file) return false;
  const maxBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxBytes;
}

/**
 * Valida tipo MIME de archivo
 * @param {File} file - Archivo a validar
 * @param {string[]} allowedTypes - Array de tipos MIME permitidos
 * @returns {boolean} true si el tipo de archivo está permitido
 * @example
 * isValidFileType(file, ["image/jpeg", "image/png"]) // true si es jpg o png
 */
export function isValidFileType(file, allowedTypes) {
  if (!file) return false;
  return allowedTypes.includes(file.type);
}

/**
 * Ejecuta múltiples validaciones sobre un valor
 * @param {*} value - Valor a validar
 * @param {Array<{fn: Function, message: string}>} validators - Array de validadores
 * @returns {{isValid: boolean, errors: string[]}} Resultado de la validación
 * @example
 * const result = validate("test@example.com", [
 *   validators.required(),
 *   validators.email()
 * ]);
 * // result = { isValid: true, errors: [] }
 */
export function validate(value, validators) {
  const errors = [];
  
  for (const validator of validators) {
    const isValid = validator.fn(value);
    if (!isValid) {
      errors.push(validator.message);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validadores predefinidos para usar con la función validate()
 * @typedef {Object} Validators
 * @property {Function} required - Valida campo requerido
 * @property {Function} email - Valida formato de email
 * @property {Function} minLength - Valida longitud mínima
 * @property {Function} maxLength - Valida longitud máxima
 * @property {Function} strongPassword - Valida contraseña segura
 */
export const validators = {
  /**
   * Validador de campo requerido
   * @param {string} [message="Este campo es requerido"] - Mensaje de error
   * @returns {{fn: Function, message: string}} Validador
   * @example
   * validate(value, [validators.required()])
   */
  required: (message = "Este campo es requerido") => ({
    fn: isRequired,
    message,
  }),
  
  /**
   * Validador de email
   * @param {string} [message="Email inválido"] - Mensaje de error
   * @returns {{fn: Function, message: string}} Validador
   * @example
   * validate(email, [validators.email()])
   */
  email: (message = "Email inválido") => ({
    fn: isValidEmail,
    message,
  }),
  
  /**
   * Validador de longitud mínima
   * @param {number} min - Longitud mínima
   * @param {string} [message] - Mensaje de error personalizado
   * @returns {{fn: Function, message: string}} Validador
   * @example
   * validate(password, [validators.minLength(8)])
   */
  minLength: (min, message = `Mínimo ${min} caracteres`) => ({
    fn: (value) => minLength(value, min),
    message,
  }),
  
  /**
   * Validador de longitud máxima
   * @param {number} max - Longitud máxima
   * @param {string} [message] - Mensaje de error personalizado
   * @returns {{fn: Function, message: string}} Validador
   * @example
   * validate(username, [validators.maxLength(20)])
   */
  maxLength: (max, message = `Máximo ${max} caracteres`) => ({
    fn: (value) => maxLength(value, max),
    message,
  }),
  
  /**
   * Validador de contraseña segura (usa passwordValidation.js)
   * @param {string} [message] - Mensaje de error personalizado
   * @param {Object} [userInfo] - Información del usuario para validación contextual
   * @returns {{fn: Function, message: string}} Validador
   * @example
   * validate(password, [validators.strongPassword()])
   * validate(password, [validators.strongPassword("Contraseña muy débil", { username, email })])
   */
  strongPassword: (message, userInfo = {}) => {
    const defaultMessage = "Contraseña débil: debe cumplir con los requisitos de seguridad";
    
    return {
      fn: (value) => isStrongPassword(value, userInfo),
      message: message || defaultMessage,
    };
  },
};
