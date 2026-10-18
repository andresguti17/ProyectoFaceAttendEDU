import {PersonService} from './PersonService';
import {UserService} from './UserService';
import {RoleService} from './RoleService';
import {UserRoleService} from './UserRoleService';
import {ActorService} from './ActorService';

// Alta de personal (docente/administrador), en espejo de
// Web/src/services/api/staffProvisioning.js:
// persona -> usuario -> rol (+ actor académico si es docente).
// Los IDs de rol se resuelven por nombre en tiempo de ejecución.
const ROLE_ALIASES = {
  admin: new Set(['administrador', 'super administrador', 'super_admin', 'school_admin']),
  teacher: new Set(['instructor']),
};

function normalizeRoleName(name) {
  return String(name ?? '').trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

function roleIdOf(role) {
  return role?.roleId ?? role?.role_id ?? null;
}

function roleNameOf(role) {
  return role?.roleName ?? role?.role_name ?? '';
}

function splitName(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return {name: parts[0] ?? '', lastName: parts.slice(1).join(' ') || parts[0] || ''};
}

export const StaffService = {
  createStaff: async ({name, code, documentNumber, email, phone, password, role, schoolId}) => {
    const {name: firstName, lastName} = splitName(name);
    const person = await PersonService.create({
      documentNumber: String(documentNumber).trim(),
      name: firstName,
      lastName,
      email: String(email).trim().toLowerCase(),
      phone: phone || null,
      status: true,
    });
    const personId = person?.personId ?? null;
    if (!personId) throw new Error('Person creation returned no id');

    try {
      const username = String(email).split('@')[0].toLowerCase().trim();
      const user = await UserService.create({
        personId,
        username,
        password,
        authenticationType: 'Local',
      });
      const userId = user?.userId ?? null;
      if (!userId) throw new Error('User creation returned no id');

      const roles = await RoleService.getAll();
      const aliases = ROLE_ALIASES[role] ?? new Set();
      const match = (Array.isArray(roles) ? roles : []).find((r) =>
        aliases.has(normalizeRoleName(roleNameOf(r))),
      );
      const roleId = match ? roleIdOf(match) : null;
      if (roleId != null) {
        await UserRoleService.assign(userId, roleId);
      }

      if (role === 'teacher') {
        if (schoolId == null) throw new Error('No school context for the teacher record');
        await ActorService.create({
          personId,
          actorTypeId: 2,
          schoolId,
          actorCode: String(code).trim(),
          status: true,
        });
      }

      if (role === 'admin') {
        // Vínculo admin→sede (actor ADMIN): la sesión queda acotada a la
        // sede elegida en vez de global.
        if (schoolId == null) throw new Error('No school context for the admin record');
        await ActorService.create({
          personId,
          actorTypeId: 3,
          schoolId,
          actorCode: String(code).trim(),
          status: true,
        });
      }

      return {personId, userId};
    } catch (err) {
      try {
        await PersonService.delete(personId);
      } catch {}
      throw err;
    }
  },
};
