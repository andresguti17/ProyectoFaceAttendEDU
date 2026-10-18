export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const validatePhone = (phone) => {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.length >= 9;
};

// ERF 6.1: soportes de justificación PDF, JPG o PNG hasta 5 MB (mismo límite que la web).
// shortcut: límite fijo en el cliente, leerlo de 07-ms-configuration cuando lo exponga.
export const SUPPORT_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const SUPPORT_FILE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const SUPPORT_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

/** null si el archivo es válido; 'format' o 'size' según la regla que incumple. */
export const validateSupportFile = (file) => {
    const extension = String(file?.name || '').split('.').pop().toLowerCase();
    const mime = String(file?.mimeType || '').toLowerCase();
    if (!SUPPORT_FILE_EXTENSIONS.includes(extension) && !SUPPORT_FILE_MIME_TYPES.includes(mime)) return 'format';
    if (file.size > SUPPORT_FILE_MAX_BYTES) return 'size';
    return null;
};
