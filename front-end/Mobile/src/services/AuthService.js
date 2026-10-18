import { request, GET, POST, refreshSession } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import AuthResponse from '../models/identity/AuthResponse';
import AuthRequest from '../models/identity/AuthRequest';
import AppUser from '../models/identity/AppUser';
import { saveToken } from '../storage/TokenStorage';
import { VerificationService } from './verificationService';
import { PasswordService } from './passwordService';
import i18n from '../utils/i18n';

/** Error de login con mensaje traducido y un código estable para la lógica. */
export function authError(code, key) {
  const error = new Error(i18n.t(key));
  error.code = code;
  return error;
}

const LOGIN_ENDPOINT = 'api/v1/auth/login';
const LOGOUT_ENDPOINT = 'api/v1/auth/logout';
const PERSONS_ENDPOINT = 'api/v1/persons';
const USERS_ENDPOINT = 'api/v1/users';
const PAGE_LIMIT = 2000;

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

function unwrapPage(data) {
  if (data && Array.isArray(data.data)) return data.data;
  return unwrap(data);
}

async function doLogin(email, password) {
  const body = new AuthRequest({ email, password }).toApi?.() ?? { email, password };
  const session = await request({
    method: POST,
    url: LOGIN_ENDPOINT,
    data: body,
    requiresAuth: false,
  });
  return session;
}

async function resolveProfile(userId) {
  try {
    const user = toSnakeDeep(
      await request({ method: GET, url: `${USERS_ENDPOINT}/${userId}`, requiresAuth: true }),
    );
    const personId = user.person_id || user.personId;
    let person = null;
    if (personId) {
      try {
        person = toSnakeDeep(
          await request({ method: GET, url: `${PERSONS_ENDPOINT}/${personId}`, requiresAuth: true }),
        );
      } catch {
        person = null;
      }
    }
    return { person, username: user.username || null };
  } catch {
    try {
      const users = await request({
        method: GET,
        url: USERS_ENDPOINT,
        params: { page: 1, limit: PAGE_LIMIT },
        requiresAuth: true,
      });
      const user = unwrapPage(users).find((u) => u.userId === userId || u.user_id === userId);
      if (!user) return { person: null, username: null };
      const personId = user.personId || user.person_id;
      let person = null;
      try {
        person = toSnakeDeep(await request({ method: GET, url: `${PERSONS_ENDPOINT}/${personId}`, requiresAuth: true }));
      } catch {
        person = null;
      }
      return { person, username: user.username };
    } catch {
      return { person: null, username: null };
    }
  }
}

async function fetchRoleNames(userId) {
  try {
    // Vía gateway Kong (relativo): el puerto directo :8083 no es alcanzable
    // desde el dispositivo en todos los entornos y rompía el login.
    const data = await request({
      method: GET,
      url: `api/v1/users/${userId}/roles`,
      requiresAuth: true,
    });
    return unwrap(data)
      .map((r) => r.roleName || r.role_name)
      .filter(Boolean);
  } catch (e) {
    // Un fallo HTTP ya trae su mensaje traducido (red, 5xx…); si no, se explica aquí.
    if (e?.name === 'ApiError') throw e;
    throw authError('ROLES_UNAVAILABLE', 'authErrors.rolesUnavailable');
  }
}

// Verifica que el rol tenga efecto real vía /auth/evaluate.
// Falla cerrado: sin verificación no hay login.
async function evaluatePermission(userId, permission) {
  const data = await request({
    method: GET,
    url: `api/v1/auth/evaluate?userId=${encodeURIComponent(userId)}&permission=${encodeURIComponent(permission)}`,
    requiresAuth: true,
  });
  const allowed = data?.allowed ?? data?.[0]?.allowed ?? false;
  if (!allowed) throw authError('ROLE_WITHOUT_PERMISSIONS', 'authErrors.roleWithoutPermissions');
  return true;
}

export const AuthService = {
  login: async (email, password) => {
    // Login directo por correo: el backend resuelve email -> usuario vía
    // identity.person.email, así que la app no tiene que resolverlo (los
    // listados de persons/users ya no son públicos).
    const identity = (email || '').trim();
    let session = null;
    let person = null;
    let username = identity;

    try {
      session = await doLogin(identity, password);
    } catch (err) {
      if (err && (err.status === 400 || err.status === 401)) throw authError('INVALID_CREDENTIALS', 'login.invalidCredentials');
      if (err && err.status === 403) throw authError('ACCOUNT_DISABLED', 'authErrors.accountDisabled');
      throw err;
    }

    const sessionId = session?.sessionId || session?.session_id || session?.id;
    const userId = session?.userId || session?.user_id;
    if (!sessionId || !userId) throw authError('SESSION_NOT_CREATED', 'authErrors.sessionNotCreated');

    // Guardar el token ANTES de las llamadas autenticadas (roles, perfil, evaluate).
    const saved = await saveToken(String(sessionId), identity);
    if (!saved) throw authError('SESSION_NOT_SAVED', 'authErrors.sessionNotSaved');

    // 3. Load roles + profile in parallel (una sola ronda tras guardar el
    // token). Antes eran 3 llamadas secuenciales pesadas que excedían el
    // timeout en dispositivos físicos.
    const [roleNames, profile] = await Promise.all([fetchRoleNames(userId), resolveProfile(userId)]);
    if (!roleNames || roleNames.length === 0) {
      throw authError('NO_ROLES', 'authErrors.noRoles');
    }

    // 3b. Verificar que el rol tenga permisos efectivos.
    await evaluatePermission(userId, 'attendance.record:read');

    // 3c. Complete the profile (person data); the session was opened with the email.
    if (!person?.person_id) {
      person = profile.person ? toSnakeDeep(profile.person) : person;
      if (profile.username) username = profile.username;
    }
    const personName = person ? [person.name, person.last_name].filter(Boolean).join(' ') : null;

    // 4. Build AuthResponse keeping the app-level shape.
    return AuthResponse.fromApi({
      token: String(sessionId),
      user: {
        user_id: userId,
        person_id: person?.person_id || null,
        username,
        email: person?.email || (identity.includes('@') ? identity : null),
        name: personName,
        roles: roleNames,
        person: person || null,
      },
    });
  },

  // GET /api/v1/auth/me?email=|username= — perfil de usuario por identificador (público en el gateway).
  me: async (identifier) => {
    const value = String(identifier || '').trim();
    const data = await request({
      method: GET,
      url: 'api/v1/auth/me',
      params: value.includes('@') ? { email: value } : { username: value },
      requiresAuth: false,
    });
    return AppUser.fromApi(toSnakeDeep(data));
  },

  // Rota la sesión opaca (POST /api/v1/auth/refresh) y guarda el sessionId nuevo.
  refreshToken: async () => refreshSession(),

  logout: async (sessionId) => {
    if (!sessionId) return;
    await request({
      method: POST,
      url: LOGOUT_ENDPOINT,
      params: { sessionId },
      requiresAuth: false,
    }).catch(() => null);
  },

  forgotPassword: async (email) => {
    return VerificationService.sendRecoveryCode(email);
  },

  resetPassword: async (email, newPassword) => {
    return PasswordService.updatePassword(email, newPassword);
  },

  verifyCode: async (email, code) => {
    return VerificationService.verifyRecoveryCode(email, code);
  },
};
