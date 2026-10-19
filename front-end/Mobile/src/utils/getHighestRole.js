import {ROLES_HIERARCHY} from "../services/constants/rolesHierarchy";

// Mapper único backend -> Mobile. Canónicos: Administrador, Instructor, Aprendiz.
// El rol global "Super Administrador" (007-split-super-admin-role) se trata
// como Administrador en Mobile. Acepta nombres legados (SUPER_ADMIN,
// SCHOOL_ADMIN, INSTRUCTOR, STUDENT, Docente, Estudiante, ADMIN, teacher...)
// para bases aún sin migrar.
const ROLE_MAP = {
  'ADMIN': 'Administrador',
  'ADMINISTRADOR': 'Administrador',
  'SUPER_ADMINISTRADOR': 'Administrador',
  'SUPER_ADMIN': 'Administrador',
  'SCHOOL_ADMIN': 'Administrador',
  'RECTOR': 'Administrador',
  'COORDINATOR': 'Administrador',
  'INSTRUCTOR': 'Instructor',
  'DOCENTE': 'Instructor',
  'TEACHER': 'Instructor',
  'STUDENT': 'Aprendiz',
  'ESTUDIANTE': 'Aprendiz',
  'APRENDIZ': 'Aprendiz',
};

export const normalizeBackendRole = (role) => {
  if (role === null || role === undefined) return null;
  // Unifica espacios como guion bajo: el catálogo guarda
  // "Super Administrador" (con espacio, 007-split-super-admin-role); sin esto
  // la llave "SUPER ADMINISTRADOR" no coincidiría con SUPER_ADMINISTRADOR.
  const key = String(role).trim().replace(/\s+/g, "_").toUpperCase();
  if (ROLE_MAP[key]) return ROLE_MAP[key];
  const canonical = ROLES_HIERARCHY.find(
    (c) => c.toUpperCase().replace(/\s+/g, "_") === key
  );
  return canonical ?? null;
};

const mapRole = (role) => normalizeBackendRole(role) ?? String(role).trim();

// Devuelve el rol más alto o null si no hay roles válidos.
// Sin fallback silencioso: quien llama debe fallar explícito.
export const getHighestRole = (roles) => {
    if (!roles || (Array.isArray(roles) && roles.length === 0)) {
        return null;
    }

    const rolesArray = Array.isArray(roles) ? roles : [roles];
    const mapped = rolesArray.map(mapRole).filter((r) => r !== null && r !== '');

    for (let i = 0; i < ROLES_HIERARCHY.length; i++) {
        const currentRole = ROLES_HIERARCHY[i];
        if (mapped.includes(currentRole)) {
            return currentRole;
        }
    }

    return null;
};
