/**
 * Funciones de formateo reutilizables para datos y texto
 */

/**
 * Formatea número con separadores de miles
 * @param {number} num - Número a formatear
 * @param {number} [decimals=0] - Cantidad de decimales
 * @returns {string} Número formateado con separadores
 * @example
 * formatNumber(1234567.89) // "1,234,567.89"
 * formatNumber(1234567.89, 2) // "1,234,567.89"
 * formatNumber(1234567, 0) // "1,234,567"
 */
export function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return "0";
  
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formatea valor como porcentaje
 * @param {number} value - Valor decimal (0.8523 = 85.23%)
 * @param {number} [decimals=2] - Cantidad de decimales
 * @returns {string} Porcentaje formateado con símbolo %
 * @example
 * formatPercentage(0.8523) // "85.23%"
 * formatPercentage(0.5, 0) // "50%"
 */
export function formatPercentage(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Formatea cantidad monetaria
 * @param {number} amount - Cantidad a formatear
 * @param {string} [currency="USD"] - Código de moneda ISO 4217
 * @returns {string} Cantidad formateada con símbolo de moneda
 * @example
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(1234.56, "EUR") // "€1,234.56"
 */
export function formatCurrency(amount, currency = "USD") {
  if (amount === null || amount === undefined || isNaN(amount)) return "$0.00";
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Trunca texto agregando ellipsis (...)
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima del texto
 * @param {string} [suffix="..."] - Sufijo a agregar al final
 * @returns {string} Texto truncado con sufijo
 * @example
 * truncate("Hello World", 5) // "Hello..."
 * truncate("Hello", 10) // "Hello"
 * truncate("Hello World", 8, ">>") // "Hello Wo>>"
 */
export function truncate(text, maxLength, suffix = "...") {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + suffix;
}

/**
 * Capitaliza la primera letra de un texto
 * @param {string} text - Texto a capitalizar
 * @returns {string} Texto con primera letra en mayúscula
 * @example
 * capitalize("hello world") // "Hello world"
 * capitalize("josé maría") // "José maría"
 */
export function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Capitaliza cada palabra del texto (Title Case)
 * @param {string} text - Texto a transformar
 * @returns {string} Texto con cada palabra capitalizada
 * @example
 * titleCase("hello world") // "Hello World"
 * titleCase("josé maría lópez") // "José María López"
 */
export function titleCase(text) {
  if (!text) return "";
  return text
    .split(" ")
    .map(word => capitalize(word))
    .join(" ");
}

/**
 * Normaliza texto eliminando acentos y caracteres especiales
 * @param {string} text - Texto a normalizar
 * @returns {string} Texto sin acentos ni caracteres especiales
 * @example
 * normalizeText("Niño con tílde") // "Nino con tilde"
 * normalizeText("José María") // "Jose Maria"
 */
export function normalizeText(text) {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Convierte texto a slug (URL-friendly)
 * @param {string} text - Texto a convertir
 * @returns {string} Slug en minúsculas con guiones
 * @example
 * slugify("Hello World!") // "hello-world"
 * slugify("Título con Ñ") // "titulo-con-n"
 */
export function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Normalizar caracteres con acentos/tildes
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Reemplazar espacios con guiones
    .replace(/\s+/g, "-")
    // Eliminar caracteres especiales excepto letras, números y guiones
    .replace(/[^\w\-]+/g, "")
    // Eliminar guiones múltiples
    .replace(/\-\-+/g, "-")
    // Eliminar guiones al inicio y final
    .replace(/^-+|-+$/g, "");
}

/**
 * Formatea nombre completo con capitalización
 * @param {string} firstName - Nombre
 * @param {string} lastName - Apellido
 * @returns {string} Nombre completo formateado
 * @example
 * formatFullName("john", "doe") // "John Doe"
 * formatFullName("MARIA", "GARCIA") // "Maria Garcia"
 */
export function formatFullName(firstName, lastName) {
  const first = capitalize(firstName || "");
  const last = capitalize(lastName || "");
  return `${first} ${last}`.trim();
}

/**
 * Obtiene iniciales de un nombre
 * @param {string} firstName - Nombre
 * @param {string} lastName - Apellido
 * @returns {string} Iniciales en mayúsculas (ej: JD)
 * @example
 * formatInitials("John", "Doe") // "JD"
 * formatInitials("maria", "garcia") // "MG"
 */
export function formatInitials(firstName, lastName) {
  const first = (firstName || "").charAt(0).toUpperCase();
  const last = (lastName || "").charAt(0).toUpperCase();
  return `${first}${last}`;
}

/**
 * Formatea número de teléfono (formato US)
 * @param {string} phone - Número de teléfono (solo dígitos o con formato)
 * @returns {string} Teléfono formateado como (123) 456-7890
 * @example
 * formatPhone("1234567890") // "(123) 456-7890"
 * formatPhone("555-1234") // "555-1234" (sin cambios si no tiene 10 dígitos)
 */
export function formatPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}

/**
 * Formatea tamaño de archivo en formato legible
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} Tamaño formateado (ej: 1.5 KB, 2.3 MB)
 * @example
 * formatFileSize(1536) // "1.5 KB"
 * formatFileSize(1048576) // "1 MB"
 * formatFileSize(0) // "0 Bytes"
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 Bytes";
  
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Oculta parte de un email para privacidad
 * @param {string} email - Email a enmascarar
 * @returns {string} Email parcialmente oculto
 * @example
 * maskEmail("john.doe@example.com") // "j***e@example.com"
 * maskEmail("ab@test.com") // "ab@test.com" (sin cambios si es muy corto)
 */
export function maskEmail(email) {
  if (!email || !email.includes("@")) return email;
  
  const [username, domain] = email.split("@");
  if (username.length <= 2) return email;
  
  const masked = username[0] + "***" + username[username.length - 1];
  return `${masked}@${domain}`;
}

/**
 * Oculta parte de un número de teléfono para privacidad
 * @param {string} phone - Teléfono a enmascarar
 * @returns {string} Teléfono parcialmente oculto (muestra últimos 4 dígitos)
 * @example
 * maskPhone("1234567890") // "******7890"
 * maskPhone("+1 (555) 123-4567") // "**********4567"
 */
export function maskPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 4) return phone;
  
  return "*".repeat(cleaned.length - 4) + cleaned.slice(-4);
}

/**
 * Convierte camelCase a Title Case con espacios
 * @param {string} camelCase - String en formato camelCase
 * @returns {string} String en Title Case
 * @example
 * camelToTitle("firstName") // "First Name"
 * camelToTitle("userEmailAddress") // "User Email Address"
 */
export function camelToTitle(camelCase) {
  if (!camelCase) return "";
  
  const result = camelCase.replace(/([A-Z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Pluraliza palabra según cantidad (español básico)
 * @param {number} count - Cantidad
 * @param {string} singular - Palabra en singular
 * @param {string} [plural] - Palabra en plural (si no se provee, agrega 's')
 * @returns {string} Texto con cantidad y palabra pluralizada
 * @example
 * pluralize(1, "item") // "1 item"
 * pluralize(2, "item") // "2 items"
 * pluralize(5, "persona", "personas") // "5 personas"
 */
export function pluralize(count, singular, plural = null) {
  const word = count === 1 ? singular : (plural || singular + "s");
  return `${count} ${word}`;
}

/**
 * Genera color consistente a partir de texto (útil para avatares)
 * @param {string} text - Texto base (nombre, email, etc.)
 * @returns {string} Color hexadecimal (#RRGGBB)
 * @example
 * getColorFromText("John Doe") // "#3B82F6" (siempre el mismo para "John Doe")
 * getColorFromText("Jane Smith") // "#EF4444" (diferente color)
 */
export function getColorFromText(text) {
  if (!text) return "#64748B";
  
  const colors = [
    "#EF4444", "#F59E0B", "#10B981", "#3B82F6", 
    "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
  ];
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}
