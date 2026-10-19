// ============================================================
//  Formatos de Fecha y Hora - SIMPLIFICADO
// ============================================================

/**
 * Formatos de fecha disponibles
 */
export const DATE_FORMATS = {
    "DD/MM/YYYY": { 
        label: "DD/MM/YYYY", 
        example: `31/12/${new Date().getFullYear()}`
    },
    "MM/DD/YYYY": { 
        label: "MM/DD/YYYY", 
        example: `12/31/${new Date().getFullYear()}`
    },
    "YYYY-MM-DD": { 
        label: "YYYY-MM-DD", 
        example: `${new Date().getFullYear()}-12-31`
    },
};

export const DEFAULT_DATE_FORMAT = "DD/MM/YYYY";

/**
 * Convierte la entrada a Date. Un texto SOLO de fecha (YYYY-MM-DD) se interpreta
 * en hora local: `new Date("2026-03-14")` se parsea como medianoche UTC y en
 * zonas detrás de UTC caía al día anterior (off-by-one).
 */
function toDate(value) {
    if (typeof value !== "string") return value;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(value);
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_ABBR = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Aplica tokens de formato (YYYY, MM, DD, HH, hh, mm, ss, ddd, dddd, A) para
 * patrones fuera de los tres predefinidos (p. ej. "dddd DD/MM/YYYY HH:mm").
 */
function applyTokens(dateObj, pattern) {
    const hours = dateObj.getHours();
    const map = {
        dddd: DAY_NAMES[dateObj.getDay()],
        ddd: DAY_ABBR[dateObj.getDay()],
        YYYY: String(dateObj.getFullYear()),
        MM: String(dateObj.getMonth() + 1).padStart(2, "0"),
        DD: String(dateObj.getDate()).padStart(2, "0"),
        HH: String(hours).padStart(2, "0"),
        hh: String(hours % 12 || 12).padStart(2, "0"),
        mm: String(dateObj.getMinutes()).padStart(2, "0"),
        ss: String(dateObj.getSeconds()).padStart(2, "0"),
        A: hours >= 12 ? "PM" : "AM",
    };
    // Ordena por longitud descendente: "dddd" antes que "ddd", "YYYY" antes que "YY".
    const tokens = Object.keys(map).sort((a, b) => b.length - a.length);
    const re = new RegExp(tokens.join("|"), "g");
    return pattern.replace(re, (tok) => map[tok] ?? tok);
}

/**
 * Formatear fecha según formato configurado. Los tres formatos predefinidos
 * usan el switch; cualquier otro patrón se resuelve por tokens.
 */
export function formatDate(date, format = DEFAULT_DATE_FORMAT) {
    const dateObj = toDate(date);

    if (!(dateObj instanceof Date) || isNaN(dateObj)) {
        return "";
    }

    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();

    switch (format) {
        case "DD/MM/YYYY":
            return `${day}/${month}/${year}`;
        case "MM/DD/YYYY":
            return `${month}/${day}/${year}`;
        case "YYYY-MM-DD":
            return `${year}-${month}-${day}`;
        default:
            return applyTokens(dateObj, String(format ?? ""));
    }
}

/**
 * Formatear hora según formato 12h/24h
 */
export function formatTime(date, is24Hour = false) {
    const dateObj = toDate(date);

    if (!(dateObj instanceof Date) || isNaN(dateObj)) {
        return "";
    }

    const hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    
    if (is24Hour) {
        return `${String(hours).padStart(2, "0")}:${minutes}`;
    } else {
        const hours12 = hours % 12 || 12;
        const ampm = hours >= 12 ? "PM" : "AM";
        return `${hours12}:${minutes} ${ampm}`;
    }
}

/**
 * Formatear fecha y hora
 */
export function formatDateTime(date, dateFormat = DEFAULT_DATE_FORMAT, is24Hour = false) {
    return `${formatDate(date, dateFormat)} ${formatTime(date, is24Hour)}`;
}
