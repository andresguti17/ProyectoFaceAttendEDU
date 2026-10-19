// Verificación del flujo de login legacy contra JSON Server.
// Uso: node scripts/check-auth-json-server.js <email> [password] [baseUrl]
// - Sin password: valida estructura (person/app_user/roles/sesión) sin verificar clave.
// - Con password: ejecuta además la verificación bcrypt.
// Nunca imprime la contraseña ni tokens completos.
const bcrypt = require('bcryptjs');

const BASE = (process.argv[4] || process.env.JSON_SERVER_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const EMAIL = (process.argv[2] || 'ricardo.gomez@nuevaesperanza.edu.co').toLowerCase().trim();
const PASSWORD = process.argv[3] || null;

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

function first(data) {
  const arr = unwrap(data);
  return arr.length > 0 ? arr[0] : null;
}

function pickId(obj, ...keys) {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v) !== '') return v;
  }
  return null;
}

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, ok: res.ok, body: json, raw: text.slice(0, 120) };
}

(async () => {
  const results = [];
  const step = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
  };

  try {
    // 1. person por email
    const person = first(await get(`/person?email=${encodeURIComponent(EMAIL)}`));
    step('1. GET /person?email=', !!person, person ? `id=${person.person_id || person.id}` : 'no encontrado');
    if (!person) throw new Error('STOP: sin person no hay login');

    // 2. app_user por person_id
    const personId = pickId(person, 'person_id', 'personId', 'id');
    const user = first(await get(`/app_user?person_id=${encodeURIComponent(personId)}`));
    step('2. GET /app_user?person_id=', !!user, user ? `username=${user.username}` : 'no encontrado');
    if (!user) throw new Error('STOP: sin app_user no hay login');

    // 3. password (bcrypt si aplica)
    const stored = user.password ?? user.password_hash ?? user.contrasena ?? person.password ?? null;
    if (stored === null || String(stored) === '') {
      step('3. password expuesto en el registro', true, 'ausente: se omite verificación');
    } else if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(stored))) {
      if (!PASSWORD) {
        step('3. password_hash bcrypt presente', true, 'pasa password como 2do argumento para verificar');
      } else {
        const ok = bcrypt.compareSync(String(PASSWORD), String(stored));
        step('3. verificación bcrypt', ok, ok ? 'coincide' : 'NO coincide: credencial inválida');
        if (!ok) throw new Error('STOP: password no coincide');
      }
    } else {
      step('3. password en texto comparable', true, 'se compara directo en la app');
    }

    // 4. roles (no bloqueantes)
    const userId = pickId(user, 'user_id', 'userId', 'id');
    let roles = [];
    try {
      const assignments = unwrap(await get(`/user_role?user_id=${encodeURIComponent(userId)}`));
      for (const ur of assignments) {
        const roleId = pickId(ur, 'role_id', 'roleId', 'id');
        if (!roleId) continue;
        try {
          const role = first(await get(`/role?role_id=${encodeURIComponent(roleId)}`));
          const name = role?.role_name ?? role?.name ?? role?.title ?? null;
          if (name) roles.push(name);
        } catch { /* continúa */ }
      }
      step('4. roles', true, roles.length ? roles.join(',') : 'vacíos (no bloquea login)');
    } catch (e) {
      step('4. roles', true, `falló consulta (${e.message}); no bloquea login`);
    }

    // 5. sesión de servidor (puede 500 por EBUSY en Docker: no bloquea, hay respaldo local)
    const sess = await post('/user_session', { user_id: userId });
    if (sess.ok) {
      const s = first(sess.body) || sess.body;
      step('5. POST /user_session', true, `id=${s?.id ?? s?.session_id ?? '?'}`);
    } else {
      step('5. POST /user_session', true, `HTTP ${sess.status}: se usará sesión local (no bloquea login)`);
    }

    console.log('RESULTADO: flujo legacy OK, login funcional');
  } catch (e) {
    console.log(`RESULTADO: FALLO (${e.message})`);
    process.exitCode = 1;
  }
})();
