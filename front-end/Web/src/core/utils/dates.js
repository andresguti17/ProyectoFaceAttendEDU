/**
 * Utilidades para manejo de fechas
 * Todas las funciones aceptan Date objects o strings parseables
 */

/**
 * Formatea fecha en el formato especificado
 * @param {Date|string} date - Fecha a formatear
 * @param {string} [format="DD/MM/YYYY"] - Formato de salida (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
 * @returns {string} Fecha formateada o string vacío si es inválida
 * @example
 * formatDate(new Date(2026, 8, 3)) // "03/09/2026"
 * formatDate("2026-09-03", "YYYY-MM-DD") // "2026-09-03"
 */
export function formatDate(date, format = "DD/MM/YYYY") {
  if (!date) return "";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  
  switch (format) {
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Formatea hora en formato 24 horas (HH:mm)
 * @param {Date|string} date - Fecha con hora a formatear
 * @returns {string} Hora formateada (HH:mm) o string vacío si es inválida
 * @example
 * formatTime(new Date(2026, 8, 3, 14, 30)) // "14:30"
 */
export function formatTime(date) {
  if (!date) return "";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  
  return `${hours}:${minutes}`;
}

/**
 * Formatea fecha y hora juntos
 * @param {Date|string} date - Fecha a formatear
 * @param {string} [dateFormat="DD/MM/YYYY"] - Formato de la fecha
 * @returns {string} Fecha y hora formateadas (DD/MM/YYYY HH:mm)
 * @example
 * formatDateTime(new Date(2026, 8, 3, 14, 30)) // "03/09/2026 14:30"
 */
export function formatDateTime(date, dateFormat = "DD/MM/YYYY") {
  if (!date) return "";
  return `${formatDate(date, dateFormat)} ${formatTime(date)}`;
}

/**
 * Obtiene tiempo relativo en español (hace X minutos/horas/días)
 * @param {Date|string} date - Fecha a comparar con ahora
 * @returns {string} Tiempo relativo formateado
 * @example
 * getRelativeTime(new Date(Date.now() - 60000)) // "hace 1 minuto"
 * getRelativeTime(new Date(Date.now() - 86400000)) // "hace 1 día"
 */
export function getRelativeTime(date) {
  if (!date) return "";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  
  const now = new Date();
  const diffMs = now - d;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffSecs < 60) return "hace un momento";
  if (diffMins < 60) return `hace ${diffMins} ${diffMins === 1 ? "minuto" : "minutos"}`;
  if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  if (diffDays < 30) return `hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`;
  if (diffMonths < 12) return `hace ${diffMonths} ${diffMonths === 1 ? "mes" : "meses"}`;
  return `hace ${diffYears} ${diffYears === 1 ? "año" : "años"}`;
}

/**
 * Verifica si una fecha es hoy
 * @param {Date|string} date - Fecha a verificar
 * @returns {boolean} true si la fecha es hoy
 * @example
 * isToday(new Date()) // true
 * isToday("2020-01-01") // false
 */
export function isToday(date) {
  if (!date) return false;
  
  const d = new Date(date);
  const today = new Date();
  
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
}

/**
 * Verifica si una fecha fue ayer
 * @param {Date|string} date - Fecha a verificar
 * @returns {boolean} true si la fecha fue ayer
 * @example
 * isYesterday(new Date(Date.now() - 86400000)) // true
 */
export function isYesterday(date) {
  if (!date) return false;
  
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return d.getDate() === yesterday.getDate() &&
         d.getMonth() === yesterday.getMonth() &&
         d.getFullYear() === yesterday.getFullYear();
}

/**
 * Obtiene el inicio del día (00:00:00.000)
 * @param {Date|string} [date=new Date()] - Fecha base
 * @returns {Date} Fecha al inicio del día
 * @example
 * startOfDay(new Date(2026, 8, 3, 14, 30)) // 2026-09-03 00:00:00.000
 */
export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Obtiene el fin del día (23:59:59.999)
 * @param {Date|string} [date=new Date()] - Fecha base
 * @returns {Date} Fecha al final del día
 * @example
 * endOfDay(new Date(2026, 8, 3, 14, 30)) // 2026-09-03 23:59:59.999
 */
export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Obtiene el inicio de la semana (lunes)
 * @param {Date|string} [date=new Date()] - Fecha base
 * @returns {Date} Primer día (lunes) de la semana
 * @example
 * startOfWeek(new Date(2026, 8, 3)) // Lunes de esa semana
 */
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Obtiene el fin de la semana (domingo)
 * @param {Date|string} [date=new Date()] - Fecha base
 * @returns {Date} Último día (domingo) de la semana
 * @example
 * endOfWeek(new Date(2026, 8, 3)) // Domingo de esa semana
 */
export function endOfWeek(date = new Date()) {
  const start = startOfWeek(date);
  return new Date(start.setDate(start.getDate() + 6));
}

/**
 * Obtiene el primer día del mes
 * @param {Date|string} [date=new Date()] - Fecha base
 * @returns {Date} Primer día del mes
 * @example
 * startOfMonth(new Date(2026, 8, 15)) // 2026-09-01
 */
export function startOfMonth(date = new Date()) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Obtiene el último día del mes
 * @param {Date|string} [date=new Date()] - Fecha base
 * @returns {Date} Último día del mes
 * @example
 * endOfMonth(new Date(2026, 8, 15)) // 2026-09-30
 */
export function endOfMonth(date = new Date()) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * Añade días a una fecha (puede ser negativo para restar)
 * @param {Date|string} date - Fecha base
 * @param {number} days - Número de días a añadir (negativo para restar)
 * @returns {Date} Nueva fecha con días añadidos
 * @example
 * addDays(new Date(2026, 8, 3), 7) // 2026-09-10
 * addDays(new Date(2026, 8, 3), -2) // 2026-09-01
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Añade meses a una fecha (puede ser negativo para restar)
 * @param {Date|string} date - Fecha base
 * @param {number} months - Número de meses a añadir (negativo para restar)
 * @returns {Date} Nueva fecha con meses añadidos
 * @example
 * addMonths(new Date(2026, 8, 3), 3) // 2026-12-03
 * addMonths(new Date(2026, 8, 3), -1) // 2026-08-03
 */
export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Calcula la diferencia en días entre dos fechas (valor absoluto)
 * @param {Date|string} date1 - Primera fecha
 * @param {Date|string} date2 - Segunda fecha
 * @returns {number} Número de días entre las fechas (siempre positivo)
 * @example
 * daysBetween("2026-09-01", "2026-09-10") // 9
 */
export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2 - d1);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calcula la edad actual a partir de fecha de nacimiento
 * @param {Date|string} birthDate - Fecha de nacimiento
 * @returns {number} Edad en años
 * @example
 * calculateAge("2000-01-01") // 26 (en 2026)
 * calculateAge("2020-01-01") // 6 (en 2026)
 */
export function calculateAge(birthDate) {
  if (!birthDate) return 0;
  
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Parsea fecha en múltiples formatos (YYYY-MM-DD, DD/MM/YYYY, etc.)
 * @param {string} dateString - String de fecha a parsear
 * @returns {Date|null} Objeto Date o null si no se puede parsear
 * @example
 * parseDate("2026-09-03") // Date object
 * parseDate("03/09/2026") // Date object
 * parseDate("invalid") // null
 */
export function parseDate(dateString) {
  if (!dateString) return null;
  
  // Intenta parsear directamente
  let date = new Date(dateString);
  if (!isNaN(date.getTime())) return date;
  
  // Intenta formato DD/MM/YYYY
  const parts = dateString.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }
  
  return null;
}

/**
 * Obtiene array de nombres de días de la semana en español
 * @param {boolean} [short=false] - Si es true, devuelve versión corta (Lun, Mar, etc.)
 * @returns {string[]} Array con nombres de días
 * @example
 * getWeekDays() // ["Domingo", "Lunes", "Martes", ...]
 * getWeekDays(true) // ["Dom", "Lun", "Mar", ...]
 */
export function getWeekDays(short = false) {
  if (short) {
    return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  }
  return ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
}

/**
 * Obtiene array de nombres de meses en español
 * @param {boolean} [short=false] - Si es true, devuelve versión corta (Ene, Feb, etc.)
 * @returns {string[]} Array con nombres de meses
 * @example
 * getMonths() // ["Enero", "Febrero", "Marzo", ...]
 * getMonths(true) // ["Ene", "Feb", "Mar", ...]
 */
export function getMonths(short = false) {
  if (short) {
    return ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  }
  return [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
}

/**
 * Verifica si una fecha está dentro de un rango (inclusivo)
 * @param {Date|string} date - Fecha a verificar
 * @param {Date|string} startDate - Fecha de inicio del rango
 * @param {Date|string} endDate - Fecha de fin del rango
 * @returns {boolean} true si la fecha está en el rango
 * @example
 * isDateInRange("2026-09-03", "2026-09-01", "2026-09-30") // true
 * isDateInRange("2026-08-01", "2026-09-01", "2026-09-30") // false
 */
export function isDateInRange(date, startDate, endDate) {
  const d = new Date(date);
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return d >= start && d <= end;
}
