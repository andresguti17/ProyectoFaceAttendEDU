import { request, GET, POST, PUT, PATCH, DELETE } from '../api/apiClient';
import AppUser from '../models/identity/AppUser';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENDPOINT = 'app_user';

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

function unwrapFirst(data) {
  const arr = unwrap(data);
  return arr.length > 0 ? arr[0] : null;
}

export const UserService = {
  getAll: async (params = {}) => {
    const data = await request({ method: GET, url: ENDPOINT, params, requiresAuth: false });
    return unwrap(data).map(AppUser.fromApi);
  },

  getById: async (id) => {
    const data = await request({ method: GET, url: `${ENDPOINT}/${id}`, requiresAuth: false });
    return AppUser.fromApi(data);
  },

  getByUsername: async (username) => {
    const data = await request({ method: GET, url: ENDPOINT, params: { username }, requiresAuth: false });
    return AppUser.fromApi(unwrapFirst(data));
  },

  create: async (userData) => {
    // ms-identity (CreateUserRequest) habla camelCase: personId,
    // username y password (8-100). El toApi en snake respondía 400.
    const u = userData ?? {};
    const body = {
      personId: u.personId ?? u.person_id,
      username: u.username,
      password: u.password,
      authenticationType: u.authenticationType ?? u.authentication_type,
    };
    Object.keys(body).forEach((k) => (body[k] === null || body[k] === undefined) && delete body[k]);
    const data = await request({ method: POST, url: ENDPOINT, data: body, requiresAuth: false });
    return AppUser.fromApi(data);
  },

  update: async (id, userData) => {
    // ms-identity (UserDto, merge parcial) habla camelCase: el toApi en snake
    // respondía 400 por propiedades desconocidas.
    const u = userData ?? {};
    const body = {
      personId: u.personId ?? u.person_id,
      username: u.username,
      authenticationType: u.authenticationType ?? u.authentication_type,
      status: u.status,
    };
    Object.keys(body).forEach((k) => (body[k] === null || body[k] === undefined) && delete body[k]);
    const data = await request({ method: PUT, url: `${ENDPOINT}/${id}`, data: body, requiresAuth: true });
    return AppUser.fromApi(data);
  },

  setStatus: async (id, status) => {
    return request({ method: PATCH, url: `${ENDPOINT}/${id}/status`, params: { status }, requiresAuth: true });
  },

  delete: async (id) => {
    return request({ method: DELETE, url: `${ENDPOINT}/${id}`, requiresAuth: false });
  },
};

export const USER_PROFILE_KEY = 'userProfile';

async function readStoredProfile() {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const getCurrentUser = async () => {
  try {
    const profile = await readStoredProfile();
    if (profile?.userId || profile?.email) {
      const role = await AsyncStorage.getItem('userRole');
      return {
        userId: profile.userId || null,
        personId: profile.personId || null,
        email: profile.email || null,
        username: profile.username || null,
        name: profile.name || null,
        roles: role ? [role] : profile.roles || [],
      };
    }
    const email = await AsyncStorage.getItem('userEmail');
    if (!email) return null;
    const user = await getUserByEmail(email);
    if (!user) return null;
    const role = await AsyncStorage.getItem('userRole');
    return {
      userId: user?.userId || null,
      personId: user?.personId || null,
      email,
      username: user?.username || null,
      name: null,
      roles: role ? [role] : [],
    };
  } catch {
    return null;
  }
};

export const getCurrentUserRole = async () => {
  try {
    const role = await AsyncStorage.getItem('userRole');
    return role || null;
  } catch {
    return null;
  }
};

// Roles crudos del perfil (nombres del backend, p. ej. "Super Administrador").
// El rol canónico guardado en 'userRole' no distingue super admin de admin de
// sede; para eso se miran los nombres originales, en espejo de
// Web/src/core/utils/backendRoles.js (hasSuperAdminRole).
const SUPER_ADMIN_KEYS = new Set(['SUPER_ADMINISTRADOR', 'SUPER_ADMIN']);

export const getUserProfileRoles = async () => {
  try {
    const profile = await readStoredProfile();
    return Array.isArray(profile?.roles) ? profile.roles : [];
  } catch {
    return [];
  }
};

export const isSuperAdmin = async () => {
  const roles = await getUserProfileRoles();
  return roles.some((r) =>
    SUPER_ADMIN_KEYS.has(String(r ?? '').trim().replace(/\s+/g, '_').toUpperCase())
  );
};

export const getUserByEmail = async (email) => {
  const normalized = (email || '').toLowerCase().trim();
  if (!normalized) return null;
  // Real identity API has no email search: page through persons, then match the user.
  const { backendGet } = require('../api/backend');
  const ENV = require('../config/env').default;
  const persons = await backendGet(ENV.API_BASE_URL, 'api/v1/persons', { page: 1, limit: 2000 });
  const person = persons.find((p) => (p.email || '').toLowerCase().trim() === normalized);
  if (!person) return null;
  const users = await backendGet(ENV.API_BASE_URL, 'api/v1/users', { page: 1, limit: 2000 });
  const user = users.find((u) => u.person_id === person.person_id);
  return user ? AppUser.fromApi(user) : null;
};

export const hasRole = async (roleName) => {
  const user = await getCurrentUser();
  return user?.roles?.includes(roleName) ?? false;
};

export const isAdmin = async () => {
  return await hasRole('Administrador');
};
