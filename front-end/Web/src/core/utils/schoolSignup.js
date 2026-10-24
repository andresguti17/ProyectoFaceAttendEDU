// ============================================================
//  FaceAttend EDU — School sign-up (pure helpers)
// ============================================================
//  Validación y armado del cuerpo de POST /api/v1/onboarding/schools.
//  Sin React ni red: lo usa useSignupViewModel y se prueba aparte.
//
//  Campos que acepta el backend hoy:
//   sede: code, name, cityName, address, phone, email
//   administrador: documentType, documentNumber, name, lastName,
//                  email, phone, username, password
// ============================================================

import { PRIVACY_POLICY_VERSION } from "../config/privacy";
import { isValidEmail, isValidPhone, checkPassword } from "./validation";

export const DOCUMENT_TYPES = ["CC", "TI", "CE", "PP"];

export const EMPTY_FORM = {
    code: "", name: "", cityName: "", address: "", phone: "", email: "",
    documentType: "", documentNumber: "", adminName: "", adminLastName: "",
    adminEmail: "", adminPhone: "", username: "", password: "", confirmPassword: "",
    // Ley 1581: aviso de privacidad (obligatorio) y autorización biométrica (facultativa).
    privacyAccepted: false, biometricAccepted: false,
};

const CODE_RE = /^[A-Z0-9][A-Z0-9-]*$/;
const DOCUMENT_NUMBER_RE = /^[A-Za-z0-9]+$/;
const USERNAME_RE = /^[a-z0-9._-]+$/;

const blank = (v) => !v || String(v).trim() === "";

/** Mantiene solo letras (con acentos), espacios y apóstrofos de un nombre. */
export function onlyLettersAndSpaces(text) {
    return String(text ?? "").replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑç\s']/g, "");
}

/** Código de sede: mayúsculas, dígitos y guion. */
export function normalizeSchoolCode(text) {
    return String(text ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

/** Usuario: minúsculas, dígitos, punto, guion y guion bajo. */
export function normalizeUsername(text) {
    return String(text ?? "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

/**
 * Errores de la sede (paso 1). Devuelve { campo: mensaje }; vacío = válido.
 * `t` traduce el mensaje.
 */
export function validateSchoolStep(values, t = (s) => s) {
    const e = {};
    if (blank(values.code)) e.code = t("El código de la sede es requerido");
    else if (!CODE_RE.test(values.code.trim())) e.code = t("Usa solo letras, números y guion");
    else if (values.code.trim().length < 2) e.code = t("El código debe tener al menos 2 caracteres");
    else if (values.code.trim().length > 50) e.code = t("El código no puede superar 50 caracteres");

    if (blank(values.name)) e.name = t("El nombre de la sede es requerido");
    else if (values.name.trim().length > 255) e.name = t("El nombre no puede superar 255 caracteres");

    if (blank(values.cityName)) e.cityName = t("La ciudad es requerida");
    else if (values.cityName.trim().length > 100) e.cityName = t("La ciudad no puede superar 100 caracteres");

    if (!blank(values.address) && values.address.trim().length > 255) {
        e.address = t("La dirección no puede superar 255 caracteres");
    }
    if (!blank(values.phone) && !isValidPhone(values.phone.trim())) {
        e.phone = t("El teléfono no es válido");
    }
    if (!blank(values.email) && !isValidEmail(values.email.trim())) {
        e.email = t("El correo de la sede no es válido");
    }
    return e;
}

/** Errores del administrador (paso 2). Devuelve { campo: mensaje }; vacío = válido. */
export function validateAdminStep(values, t = (s) => s) {
    const e = {};
    if (!DOCUMENT_TYPES.includes(values.documentType)) e.documentType = t("Selecciona el tipo de documento");

    if (blank(values.documentNumber)) e.documentNumber = t("El número de documento es requerido");
    else if (!DOCUMENT_NUMBER_RE.test(values.documentNumber.trim())) e.documentNumber = t("Usa solo letras y números");
    else if (values.documentNumber.trim().length > 50) e.documentNumber = t("El documento no puede superar 50 caracteres");

    if (blank(values.adminName)) e.adminName = t("Los nombres son requeridos");
    if (blank(values.adminLastName)) e.adminLastName = t("Los apellidos son requeridos");

    if (blank(values.adminEmail)) e.adminEmail = t("El correo electrónico es requerido");
    else if (!isValidEmail(values.adminEmail.trim())) e.adminEmail = t("El correo electrónico no es válido");

    if (!blank(values.adminPhone) && !isValidPhone(values.adminPhone.trim())) {
        e.adminPhone = t("El teléfono no es válido");
    }

    if (blank(values.username)) e.username = t("El nombre de usuario es requerido");
    else if (values.username.trim().length < 3) e.username = t("El nombre debe tener al menos 3 caracteres");
    else if (!USERNAME_RE.test(values.username.trim())) e.username = t("Usa minúsculas, números, punto o guion");

    if (blank(values.password)) {
        e.password = t("La contraseña es requerida");
    } else {
        const check = checkPassword(values.password, { username: values.username, email: values.adminEmail });
        if (!check.isValid) e.password = t(check.errors[0]);
    }

    if (blank(values.confirmPassword)) e.confirmPassword = t("Confirma la contraseña");
    else if (values.confirmPassword !== values.password) e.confirmPassword = t("Las contraseñas no coinciden");

    if (values.privacyAccepted !== true) e.privacyAccepted = t("Debes aceptar el aviso de privacidad");
    return e;
}

const trimmed = (v) => String(v ?? "").trim();
const optional = (v) => (trimmed(v) === "" ? undefined : trimmed(v));

/** Cuerpo de POST /api/v1/onboarding/schools a partir del formulario ya validado. */
export function buildOnboardingPayload(values) {
    return {
        school: {
            code: trimmed(values.code),
            name: trimmed(values.name),
            cityName: trimmed(values.cityName),
            address: optional(values.address),
            phone: optional(values.phone),
            email: optional(values.email),
        },
        admin: {
            documentType: values.documentType,
            documentNumber: trimmed(values.documentNumber),
            name: trimmed(values.adminName),
            lastName: trimmed(values.adminLastName),
            email: trimmed(values.adminEmail),
            phone: optional(values.adminPhone),
            username: trimmed(values.username),
            password: values.password,
            privacyPolicyVersion: PRIVACY_POLICY_VERSION,
            biometricAccepted: values.biometricAccepted === true,
        },
    };
}

/**
 * Traduce el error del backend a { field, message } para mostrarlo junto al
 * campo (o { field: null } para un aviso general). `step` indica el paso donde
 * vive el campo, para volver a él.
 */
export function mapOnboardingError(error, t = (s) => s) {
    const status = error?.status;
    const detail = String(error?.message ?? "");
    if (status === 409) {
        if (/school/i.test(detail)) return { field: "code", step: 1, message: t("Ya existe una sede con ese código") };
        if (/user/i.test(detail)) return { field: "username", step: 2, message: t("Ese nombre de usuario ya está en uso") };
        return {
            field: null,
            step: 2,
            message: t("Ya existe un registro con ese documento o correo. Revisa los datos del administrador."),
        };
    }
    if (status === 429) return { field: null, message: t("Demasiados intentos. Espera un minuto e inténtalo de nuevo.") };
    if (status === 503) return { field: null, message: t("El registro de sedes no está disponible por ahora. Inténtalo más tarde.") };
    if (status === 0) return { field: null, message: t("No se pudo conectar con el servidor. Revisa tu conexión.") };
    if (status === 400) return { field: null, message: detail || t("Revisa los datos ingresados.") };
    return { field: null, message: t("No se pudo completar el registro. Inténtalo de nuevo.") };
}
