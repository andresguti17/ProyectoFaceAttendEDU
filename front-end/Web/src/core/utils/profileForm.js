// ============================================================
//  FaceAttend EDU — Perfil propio (helpers puros)
// ============================================================
//  Validación y armado del cuerpo de PUT /api/v1/auth/me/profile.
//  Solo estos campos son editables por la propia persona; nombres,
//  documento, usuario, rol y sede los cambia la administración.
// ============================================================

import { birthDateError, isValidEmail, isValidPhone } from "./validation";

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const trimmed = (v) => String(v ?? "").trim();

/** Valores iniciales del formulario a partir de la persona del backend. */
export function profileFormFrom(person) {
    return {
        phone: person?.phone ?? "",
        address: person?.address ?? "",
        birthDate: person?.birthDate ?? "",
        bloodType: person?.bloodType ?? "",
        email: person?.email ?? "",
        currentPassword: "",
    };
}

/** El correo es el identificador de login: cambiarlo exige la contraseña actual. */
export function emailChanged(values, original) {
    return trimmed(values.email).toLowerCase() !== trimmed(original?.email).toLowerCase();
}

/** Hay algo que guardar (la contraseña sola no cuenta como cambio). */
export function hasProfileChanges(values, original) {
    const base = profileFormFrom(original);
    return ["phone", "address", "birthDate", "bloodType"].some((k) => trimmed(values[k]) !== trimmed(base[k]))
        || emailChanged(values, original);
}

/** Errores por campo; vacío = válido. `original` es la persona cargada del backend. */
export function validateProfile(values, original, t = (s) => s) {
    const e = {};
    if (trimmed(values.phone) && !isValidPhone(trimmed(values.phone))) e.phone = t("El teléfono no es válido");
    if (trimmed(values.address).length > 255) e.address = t("La dirección no puede superar 255 caracteres");

    const birthError = birthDateError(values.birthDate);
    if (birthError) e.birthDate = t(birthError);

    if (trimmed(values.bloodType) && !BLOOD_TYPES.includes(trimmed(values.bloodType))) {
        e.bloodType = t("Selecciona un tipo de sangre válido");
    }

    if (!trimmed(values.email)) e.email = t("El correo electrónico es requerido");
    else if (!isValidEmail(trimmed(values.email))) e.email = t("El correo electrónico no es válido");
    else if (emailChanged(values, original) && !values.currentPassword) {
        e.currentPassword = t("Ingresa tu contraseña actual para cambiar el correo");
    }
    return e;
}

/**
 * Cuerpo de PUT /auth/me/profile. Los campos editables viajan siempre (el
 * backend los reemplaza tal cual; vacío = borrar); el correo y la contraseña
 * actual solo cuando el correo cambió.
 */
export function buildProfilePayload(values, original) {
    const payload = {
        phone: trimmed(values.phone),
        address: trimmed(values.address),
        birthDate: trimmed(values.birthDate) || null,
        bloodType: trimmed(values.bloodType),
    };
    if (emailChanged(values, original)) {
        payload.email = trimmed(values.email).toLowerCase();
        payload.currentPassword = values.currentPassword;
    }
    return payload;
}

/** Error del backend → { field, message } (field null = aviso general). */
export function mapProfileError(error, t = (s) => s) {
    const status = error?.status;
    const detail = String(error?.message ?? "");
    if (status === 409) return { field: "email", message: t("Ya existe una cuenta con ese correo") };
    if (status === 400 && /current password is incorrect/i.test(detail)) {
        return { field: "currentPassword", message: t("La contraseña actual no es correcta") };
    }
    if (status === 400) return { field: null, message: detail || t("Revisa los datos ingresados.") };
    if (status === 0) return { field: null, message: t("No se pudo conectar con el servidor. Revisa tu conexión.") };
    return { field: null, message: t("No se pudo guardar el perfil. Inténtalo de nuevo.") };
}
