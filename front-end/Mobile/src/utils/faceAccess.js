// Reglas de acceso al rostro. Una sola fuente para la pantalla y las pruebas.

// Roles que pueden volver a registrar un rostro ya existente; el resto solo una vez.
export const REGISTER_EXEMPT_ROLES = ['Administrador', 'Super Administrador'];

/** Motivo por el que no se puede registrar/actualizar el rostro, o null si se puede. */
export function faceAccessDenial({isUpdate = false, unlocked = false, role, hasFace = false}) {
    if (isUpdate) return unlocked ? null : 'updateLocked';
    if (REGISTER_EXEMPT_ROLES.includes(role)) return null;
    return hasFace ? 'alreadyRegistered' : null;
}
