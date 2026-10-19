// Seed test data into FaceAttendEDU microservices.
// Run: npm run seed (Node >= 20, no dependencies).
// Targets direct microservice URLs (see .env.example) to bypass Kong JWT.
//
// Scale: 2 colombian high schools (bachillerato), 1600 students + 80 teachers,
// ~1210 class sessions and ~81k attendance records inside a pinned 4-week
// window, so web/mobile can exercise list, filter and dashboard performance.
//
// Reruns are idempotent: full collection indexes are loaded once per service
// and every create is a map hit on rerun (no 409 churn). SEED_VERBOSE=1 logs
// every successful request; SEED_CONCURRENCY tunes the parallel pool (default 8).

import path from "node:path";
import { fileURLToPath } from "node:url";

// The local .env mirrors .env.example; older Nodes or a missing file just
// fall back to the defaults below.
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));
  }
} catch { /* no .env: use defaults */ }

const U = {
  identity: process.env.IDENTITY_URL ?? "http://localhost:8081",
  authorization: process.env.AUTHORIZATION_URL ?? "http://localhost:8082",
  academic: process.env.ACADEMIC_URL ?? "http://localhost:8083",
  scheduling: process.env.SCHEDULING_URL ?? "http://localhost:8084",
  attendance: process.env.ATTENDANCE_URL ?? "http://localhost:8085",
  biometric: process.env.BIOMETRIC_URL ?? "http://localhost:8086",
  configuration: process.env.CONFIGURATION_URL ?? "http://localhost:8087",
  notification: process.env.NOTIFICATION_URL ?? "http://localhost:8088",
  quality: process.env.QUALITY_URL ?? "http://localhost:8089",
};

const VERBOSE = process.env.SEED_VERBOSE === "1";
const CONCURRENCY = Math.min(64, Math.max(1, Number(process.env.SEED_CONCURRENCY ?? 8)));

// Pinned date window: fixed constants keep reruns idempotent (the same session
// dates are requested every run instead of drifting with the wall clock).
// 2026-09-07 is a Monday, so SEED_TODAY (also a Monday) closes the window.
const WINDOW_START = "2026-09-07"; // first session/matriculation date (4 weeks back)
const SEED_TODAY = "2026-10-05";   // sessions on this date stay Open, older ones Closed
const PERIOD_END = "2026-12-18";   // active academic period ends

const results = [];
const ids = {};

// Full-collection indexes built once per run (see loadIndexes in each phase).
const M = {
  persons: new Map(),       // documentNumber -> personId
  users: new Map(),         // username -> userId
  roles: new Map(),         // roleName -> roleId
  schools: new Map(),       // code -> school row
  programs: new Map(),      // `${schoolId}:${code}` -> programId
  periods: new Map(),       // `${schoolId}:${name}` -> periodId
  cohorts: new Map(),       // code -> cohortId
  courses: new Map(),       // `${programId}:${code}` -> courseId
  actors: new Map(),        // actorCode -> academicActorId
  enrollments: new Set(),   // `${actorId}:${cohortId}`
  envs: new Map(),          // `${schoolId}:${code}` -> environmentId
  blocks: new Map(),        // `${cohortId}:${courseId}` -> scheduleBlockId
  justTypes: new Map(),     // name -> justificationTypeId
  justifications: new Set(),// attendanceRecordId with a justification
  alertTypes: new Map(),    // code -> alertTypeId
  alerts: new Set(),        // `${actorId}:${typeId}`
  projects: new Set(),      // quality project names
  updateCases: new Set(),   // personIds with a pending biometric update case
};

async function call(service, method, path, body, allow404 = false) {
  const url = `${U[service]}${path}`;
  const label = `${method} ${service}${path}`;
  try {
    const headers = { "Content-Type": "application/json" };
    if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    // 409: rerun, test data already exists. 404 is fine only for probes
    // (biometric "is this person enrolled?" checks), never for writes.
    const ok = res.ok || res.status === 409 || (allow404 && res.status === 404);
    results.push({ label, status: res.status, ok });
    if (!ok) console.log(`FAIL ${res.status} ${label}`);
    else if (VERBOSE) console.log(`ok   ${res.status}${res.status === 409 ? " (exists)" : ""} ${label}`);
    return ok ? data : null;
  } catch (e) {
    results.push({ label, status: 0, ok: false });
    console.log(`FAIL conn ${label} (${e.cause?.code ?? e.message})`);
    return null;
  }
}

const get = (s, p) => call(s, "GET", p);
const getProbe = (s, p) => call(s, "GET", p, undefined, true); // 404 = "not there yet", not a failure
const post = (s, p, b) => call(s, "POST", p, b);
const patch = (s, p, b) => call(s, "PATCH", p, b);
const pick = (obj, ...keys) => { for (const k of keys) if (obj?.[k] !== undefined) return obj[k]; return null; };
const asArray = (v) => (Array.isArray(v) ? v : v?.data ?? v?.alerts ?? v?.alert_types ?? []);

// Bounded concurrency: every bulk phase runs through this pool so ~13k
// requests finish in minutes instead of half an hour.
async function pooled(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

// Progress line for phases with hundreds of requests (console stays readable).
const progress = (total, step, label) => {
  let n = 0;
  return () => { if (++n % step === 0 || n === total) console.log(`    ${label} ${n}/${total}`); };
};

const banner = (name) => {
  const t0 = Date.now();
  console.log(`\n--- ${name}`);
  return () => console.log(`    ${name} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
};

// identity: PageResponse {data, meta} with MAX_LIMIT 100 (page-based).
async function listAllPaged(service, path) {
  const out = [];
  for (let page = 1; page <= 500; page++) {
    const chunk = await get(service, `${path}${path.includes("?") ? "&" : "?"}page=${page}&limit=100`);
    const data = Array.isArray(chunk) ? chunk : (chunk?.data ?? []);
    out.push(...data);
    if (!data.length || page >= (chunk?.meta?.totalPages ?? 1)) break;
  }
  return out;
}

// academic (?limit&offset, max 100) and notification (?limit&offset): page until short.
async function listPaged(service, path) {
  const out = [];
  for (let offset = 0; offset < 50000; offset += 100) {
    const data = asArray(await get(service, `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`));
    out.push(...data);
    if (data.length < 100) break;
  }
  return out;
}

// Map-first create: on rerun the preloaded index answers without a request;
// an unexpected conflict falls back to a list lookup so chained ids survive.
async function upsert(service, path, body, { idKeys, map, mapKey, matchKey, matchValue, fetchList }) {
  if (map && mapKey != null && map.has(mapKey)) return map.get(mapKey);
  const created = await post(service, path, body);
  const id = created ? pick(created, ...idKeys) : null;
  if (id != null) {
    if (map && mapKey != null) map.set(mapKey, id);
    return id;
  }
  const found = asArray(await fetchList()).find((e) => e?.[matchKey] === matchValue);
  const existing = found ? pick(found, ...idKeys) : null;
  if (existing != null && map && mapKey != null) map.set(mapKey, existing);
  return existing;
}

// Realistic colombian demo catalog (stable keys keep reruns idempotent).
const PEOPLE = [
  { documentNumber: "1014287635", name: "Valentina", lastName: "Ríos Herrera", email: "valentina.rios@example.com", documentType: "CC", actorCode: "EST-2026-001", biometricId: "est-2026-001", address: "Calle 134 # 54-20, Suba", birthDate: "2009-03-14", bloodType: "O+" },
  { documentNumber: "1014298812", name: "Santiago", lastName: "Herrera Mora", email: "santiago.herrera@example.com", documentType: "CC", actorCode: "EST-2026-002", biometricId: "est-2026-002", address: "Carrera 68 # 24-15, Kennedy", birthDate: "2009-07-02", bloodType: "A+" },
  { documentNumber: "1020804451", name: "Camila", lastName: "Torres Vargas", email: "camila.torres@example.com", documentType: "CC", actorCode: "EST-2026-003", biometricId: "est-2026-003", address: "Diagonal 45 # 12-30, Engativá", birthDate: "2010-11-21", bloodType: "O-" },
  { documentNumber: "1020812398", name: "Daniel", lastName: "Vargas Castillo", email: "daniel.vargas@example.com", documentType: "CC", actorCode: "EST-2026-004", biometricId: "est-2026-004", address: "Transversal 93 # 53-48, Usaquén", birthDate: "2009-05-09", bloodType: "B+" },
  { documentNumber: "1030665124", name: "Lucía", lastName: "Fernández Rojas", email: "lucia.fernandez@example.com", documentType: "CC", actorCode: "EST-2026-005", biometricId: "est-2026-005", address: "Avenida 19 # 104-62, Chapinero", birthDate: "2010-01-27", bloodType: "A-" },
  { documentNumber: "1030678903", name: "Mateo", lastName: "Castillo Ospina", email: "mateo.castillo@example.com", documentType: "CC", actorCode: "EST-2026-006", biometricId: "est-2026-006", address: "Calle 80 # 69-40, Fontibón", birthDate: "2009-09-18", bloodType: "O+" },
];
// Staff personas (linked to users + roles below).
const STAFF = [
  { documentNumber: "79852314", name: "Carolina", lastName: "Mendoza Ruiz", email: "carolina.mendoza@example.com", documentType: "CC", key: "admin", address: "Carrera 15 # 88-64, Chapinero", birthDate: "1984-06-11", bloodType: "AB+" },
  { documentNumber: "79981245", name: "Carlos", lastName: "Restrepo Álvarez", email: "carlos.restrepo@example.com", documentType: "CC", key: "instructor", address: "Calle 53 # 40-22, Laureles", birthDate: "1979-12-03", bloodType: "O+" },
];
// Demo logins (local testing only, never reuse in production):
//   Administrador: Carolina Mendoza Ruiz / username carolina.mendoza / password Admin2026*
//   Docente:       Carlos Restrepo Álvarez / username carlos.restrepo / password Docente2026*
//   Estudiante:    Valentina Ríos Herrera  / username valentina.rios  / password Estudiante2026*
// The 80 seeded teachers all log in as username (see TEACHERS) / password
// TEACHER_PASSWORD (default Docente2026*). Override any of them via
// SEED_USERNAME / SEED_PASSWORD, INSTRUCTOR_USERNAME / INSTRUCTOR_PASSWORD,
// STUDENT_USERNAME / STUDENT_PASSWORD, TEACHER_PASSWORD.
const SEED_USERNAME = process.env.SEED_USERNAME ?? "carolina.mendoza";
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Admin2026*";
const INSTRUCTOR_USERNAME = process.env.INSTRUCTOR_USERNAME ?? "carlos.restrepo";
const INSTRUCTOR_PASSWORD = process.env.INSTRUCTOR_PASSWORD ?? "Docente2026*";
const STUDENT_USERNAME = process.env.STUDENT_USERNAME ?? "valentina.rios";
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD ?? "Estudiante2026*";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD ?? "Docente2026*";
const SCHOOL_ADMIN_PASSWORD = process.env.SCHOOL_ADMIN_PASSWORD ?? "Rector2026*";
// Bootstrap admin from DB seeds (01-bootstrap-admin-user + 005 role assignment).
// The seed needs its session token: protected endpoints require Bearer + permissions.
const BOOTSTRAP_USERNAME = process.env.BOOTSTRAP_USERNAME ?? "admin.faceattend";
const BOOTSTRAP_PASSWORD = process.env.BOOTSTRAP_PASSWORD ?? "Admin123!ChangeMe";
let TOKEN = null;

// ---------------------------------------------------------------------------
// Colombian bachillerato roster: 2 schools x 800 students, 40 teachers each.
// ---------------------------------------------------------------------------
const SCHOOLS = [
  { code: "ICT-01", prefix: "ICT", name: "Institución Educativa Distrital Camilo Torres", city: "Bogotá" },
  { code: "SMP-02", prefix: "SMP", name: "Institución Educativa San Martín de Porres", city: "Medellín" },
];
// Un administrador por sede. El admin global no tiene academic_actor, asi que no
// hay dato con el cual acotar lo que ve; estos si lo tienen y el frontend resuelve
// su sede con GET /academic-actors?personId=.
const SCHOOL_ADMINS = [
  {
    schoolIdx: 0, documentNumber: "52874109", name: "Marcela", lastName: "Quintero Pardo",
    username: "admin.ict", email: "marcela.quintero@ict.edu.co",
    phone: "3106742188", address: "Calle 72 # 11-45, Chapinero",
    birthDate: "1981-04-22", bloodType: "A+", actorCode: "ADM-ICT-001",
  },
  {
    schoolIdx: 1, documentNumber: "71204836", name: "Hernán", lastName: "Ocampo Zuluaga",
    username: "admin.smp", email: "hernan.ocampo@smp.edu.co",
    phone: "3014529073", address: "Carrera 70 # 44-18, Laureles",
    birthDate: "1976-09-08", bloodType: "O+", actorCode: "ADM-SMP-001",
  },
];
// Un estudiante con login por sede, reutilizando dos de los ya sembrados: asi
// arrastran su ficha, matricula y asistencia reales.
const STUDENT_LOGINS = [
  { schoolIdx: 0, username: "est.ict" },
  { schoolIdx: 1, username: "est.smp" },
];

// Small schools from the previous seed: soft-disabled (status=false) once the
// big schools exist, so school pickers show exactly the 2 active institutions.
const LEGACY_SCHOOL_CODES = ["ANDES-01", "SAM-02", "ROS-03", "SEED-SCH"];
// Tipos de justificacion de corridas viejas: duplican en ingles los tres tipos
// del catalogo y los tres en espanol, asi que /justification-types devolvia
// ocho filas para tres conceptos. Se desactivan, no se borran (soft delete).
const LEGACY_JUSTIFICATION_TYPES = ["Seed Medical", "Seed Calamity"];
// Tipos de alerta que el seed creaba por su cuenta antes de reusar el catalogo:
// dejaban dos alertas por estudiante, una por cada copia del mismo motivo.
const LEGACY_ALERT_TYPE_CODES = ["ABSENTEEISM", "TARDINESS", "LOW_ATTENDANCE", "SEED_ABSENCE"];
// Actor de pruebas de una corrida vieja: encabezaba la lista de estudiantes.
const LEGACY_ACTOR_CODES = ["SEED-STU-01"];
const PROGRAMS = [
  { code: "BTI-26", name: "Bachillerato Técnico en Informática" },
  { code: "BNC-26", name: "Bachillerato con Énfasis en Ciencias Naturales" },
];
const SUBJECTS = [
  { code: "MAT", name: "Matemáticas", creditHours: 3 },
  { code: "LEN", name: "Lengua Castellana", creditHours: 3 },
  { code: "ING", name: "Inglés", creditHours: 2 },
  { code: "CNA", name: "Ciencias Naturales", creditHours: 3 },
  { code: "CSO", name: "Ciencias Sociales", creditHours: 3 },
  { code: "ETY", name: "Ética y Valores", creditHours: 2 },
  { code: "EDF", name: "Educación Física", creditHours: 1 },
  { code: "TEC", name: "Tecnología e Informática", creditHours: 2 },
  { code: "QUI", name: "Química", creditHours: 3 },
  { code: "BIO", name: "Biología", creditHours: 3 },
  { code: "FIS", name: "Física", creditHours: 3 },
  { code: "EMP", name: "Emprendimiento e Innovación", creditHours: 2 },
];
const GRADES = [6, 7, 8, 9, 10, 11];          // bachillerato: 6-9 básica, 10-11 media
const COHORTS_PER_SCHOOL = GRADES.length * 2;  // one cohort per grade per énfasis (A/B)
const STUDENTS_PER_SCHOOL = 800;
const STUDENT_COUNT = STUDENTS_PER_SCHOOL * SCHOOLS.length;
const TEACHERS_PER_SCHOOL = 40;
const TEACHER_COUNT = TEACHERS_PER_SCHOOL * SCHOOLS.length;
// 12 weekly blocks per cohort (full school day), 6 two-hour slots per weekday.
const SLOT_COUNT = 5 * 6;
const START_HOURS = [6, 8, 10, 12, 14, 16];

const FIRST_F = ["Valentina", "Camila", "Lucía", "María", "Sofía", "Isabella", "Salomé", "Elena", "Daniela", "Laura", "Paula", "Gabriela", "Ana", "Juliana", "Mariana", "Diana", "Carolina", "Fernanda", "Victoria", "Regina"];
const FIRST_M = ["Santiago", "Daniel", "Mateo", "Juan", "Andrés", "Sebastián", "Nicolás", "Samuel", "Gabriel", "Carlos", "David", "Diego", "Julián", "Emiliano", "Tomás", "Lucas", "Martín", "Alejandro", "Felipe", "Óscar"];
const LAST = ["García", "Rodríguez", "Gómez", "López", "Martínez", "Hernández", "Sánchez", "Ramírez", "Torres", "Arias", "Vargas", "Castillo", "Morales", "Ortiz", "Rojas", "Álvarez", "Mendoza", "Restrepo", "Ospina", "Quintero", "Rendón", "Sepúlveda", "Valencia", "Zapata", "Cruz", "Fuentes", "Guerrero", "Ibarra", "Jiménez", "Peña", "Salazar", "Urbina", "Vega", "Acosta", "Bermúdez", "Cárdenas", "Duarte", "Espinosa", "Fajardo", "Gallardo"];

const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const pad2 = (n) => String(n).padStart(2, "0");
// Grades 6-9 are minors (TI), 10-11 already carry a CC: how colombian schools work.
const cohortCodeOf = (schoolIdx, cohortIdx) => {
  const grade = GRADES[Math.floor(cohortIdx / 2)];
  return `${SCHOOLS[schoolIdx].prefix}-${grade}${cohortIdx % 2 === 0 ? "A" : "B"}`;
};

// Atributos demográficos: sin ellos cada persona que devolvía /persons era
// nombre + documento + nulls, así que las 1600 filas se veían idénticas.
// Hemoclasificación con distribución aproximada a la colombiana (O+ dominante).
const BLOOD_TYPES = ["O+", "O+", "O+", "O+", "A+", "A+", "A+", "B+", "O-", "A-", "AB+", "B-", "AB-", "O+", "A+", "B+"];
const STREET_KINDS = ["Calle", "Carrera", "Diagonal", "Transversal", "Avenida"];
const NEIGHBOURHOODS = [
  ["Suba", "Kennedy", "Engativá", "Usaquén", "Bosa", "Fontibón", "Chapinero", "Teusaquillo"],
  ["Belén", "Laureles", "Robledo", "Envigado", "Itagüí", "La América", "Castilla", "Buenos Aires"],
];
const MOBILE_PREFIXES = ["300", "301", "310", "311", "312", "320", "321", "322", "350", "351"];

/** Dirección con forma catastral colombiana: "Calle 45 # 12-30, Suba". */
const addressFor = (schoolIdx, i) => {
  const kind = STREET_KINDS[i % STREET_KINDS.length];
  const main = 1 + ((i * 13) % 180);
  const cross = 1 + ((i * 7) % 120);
  const plate = 10 + ((i * 29) % 89);
  const barrios = NEIGHBOURHOODS[schoolIdx] ?? NEIGHBOURHOODS[0];
  return `${kind} ${main} # ${cross}-${plate}, ${barrios[(i * 3) % barrios.length]}`;
};
const phoneFor = (i) => `${MOBILE_PREFIXES[i % MOBILE_PREFIXES.length]}${String(2000000 + ((i * 7919) % 7999999)).slice(-7)}`;
const bloodFor = (i) => BLOOD_TYPES[(i * 5 + 3) % BLOOD_TYPES.length];
/** Cumpleaños repartidos por el año: los filtros por fecha devuelven tramos distintos. */
const birthDateFor = (year, i) => `${year}-${pad2(1 + (i % 12))}-${pad2(1 + ((i * 17) % 28))}`;

function buildStudents() {
  const list = [];
  for (let i = 0; i < STUDENT_COUNT; i++) {
    const schoolIdx = i < STUDENTS_PER_SCHOOL ? 0 : 1;
    const local = i % STUDENTS_PER_SCHOOL;
    const female = i % 2 === 0;
    const first = (female ? FIRST_F : FIRST_M)[Math.floor(i / 2) % FIRST_F.length];
    const last1 = LAST[Math.floor(i / LAST.length) % LAST.length];
    const last2 = LAST[(i * 7 + 13) % LAST.length];
    const cohortIdx = Math.floor((local * COHORTS_PER_SCHOOL) / STUDENTS_PER_SCHOOL);
    const grade = GRADES[Math.floor(cohortIdx / 2)];
    const documentType = grade <= 9 ? "TI" : "CC";
    // Edad coherente con el grado: 6º ronda los 11-12 años en 2026, 11º los 16-17.
    const birthYear = 2026 - (grade + 5);
    const slug = `${stripAccents(first).toLowerCase()}.${stripAccents(last1).toLowerCase()}${i + 1}`;
    list.push({
      seq: i + 1,
      schoolIdx,
      name: first,
      lastName: `${last1} ${last2}`,
      documentType,
      documentNumber: `${documentType === "TI" ? "1098" : "1095"}${String(1000000 + i)}`,
      email: `${slug}@estudiantes.${SCHOOLS[schoolIdx].prefix.toLowerCase()}.edu.co`,
      phone: phoneFor(i),
      address: addressFor(schoolIdx, i),
      birthDate: birthDateFor(birthYear, i),
      bloodType: bloodFor(i),
      // 1 de cada 50 inactivo: sin esto, filtrar por estado devolvía siempre todo.
      status: i % 50 !== 37,
      actorCode: `EST-${SCHOOLS[schoolIdx].prefix}-${String(i + 1).padStart(4, "0")}`,
      cohortCode: cohortCodeOf(schoolIdx, cohortIdx),
    });
  }
  return list;
}

function buildTeachers() {
  const used = new Set([SEED_USERNAME, INSTRUCTOR_USERNAME, STUDENT_USERNAME, BOOTSTRAP_USERNAME]);
  const list = [];
  for (let i = 0; i < TEACHER_COUNT; i++) {
    const schoolIdx = i < TEACHERS_PER_SCHOOL ? 0 : 1;
    const local = i % TEACHERS_PER_SCHOOL;
    const female = i % 2 === 0;
    const first = (female ? FIRST_F : FIRST_M)[Math.floor(i / 2) % FIRST_F.length];
    const last1 = LAST[i % LAST.length];
    const last2 = LAST[(i * 11 + 5) % LAST.length];
    const base = `${stripAccents(first).toLowerCase()}.${stripAccents(last1).toLowerCase()}`;
    let username = base;
    for (let n = 2; used.has(username); n++) username = `${base}${n}`;
    used.add(username);
    list.push({
      seq: i + 1,
      schoolIdx,
      name: first,
      lastName: `${last1} ${last2}`,
      documentType: "CC",
      documentNumber: `1096${String(1000000 + i)}`,
      // Correo institucional en vez de example.com: distingue docente de estudiante a simple vista.
      email: `${username}@${SCHOOLS[schoolIdx].prefix.toLowerCase()}.edu.co`,
      phone: phoneFor(i * 3 + 1),
      address: addressFor(schoolIdx, i * 5 + 2),
      // Planta docente entre 31 y 58 años.
      birthDate: birthDateFor(1968 + ((i * 7) % 28), i),
      bloodType: bloodFor(i * 2 + 1),
      status: true,
      username,
      actorCode: `DOC-${SCHOOLS[schoolIdx].prefix}-${String(local + 1).padStart(3, "0")}`,
    });
  }
  return list;
}

const STUDENTS = buildStudents();
const TEACHERS = buildTeachers();

// Login as bootstrap admin: protected endpoints require Bearer + permissions.
// Runs before any seed step; without TOKEN the calls below fail with 401/403.
async function loginSeed() {
  const session = await post("identity", "/api/v1/auth/login", { username: BOOTSTRAP_USERNAME, password: BOOTSTRAP_PASSWORD });
  TOKEN = session ? (pick(session, "sessionId", "session_id", "id") ? String(pick(session, "sessionId", "session_id", "id")) : null) : null;
  if (!TOKEN) console.log("WARN no bootstrap session: protected calls will fail (run DB seeds first)");
}

const personBody = (p) => {
  const b = { documentNumber: p.documentNumber, name: p.name, lastName: p.lastName, documentType: p.documentType };
  b.status = p.status !== false;
  // Opcionales del modelo (PersonDto los acepta todos). Antes solo viajaban email
  // y phone, asi que address / birthDate / bloodType quedaban NULL en las 1693
  // personas y la coleccion entera se veia igual fila tras fila.
  for (const k of ['email', 'phone', 'address', 'birthDate', 'bloodType']) if (p[k]) b[k] = p[k];
  return b;
};

// Identity: persons (1690), users (demo logins + 80 teachers).
async function seedIdentity() {
  const done = banner("identity");
  // identity.city fue retirado del modelo (las ciudades ahora salen de la API
  // externa countriesnow.space): ya no existe GET/POST /api/v1/cities y cada
  // corrida solo sumaba 5 FAIL 404. El campo city_name de schools se llena con
  // SCHOOLS[].city y cityId numérico queda en el default del endpoint.
  ids.cityId = 1;

  // One pass over the full collections turns every rerun create into a map hit.
  const existingPersons = new Map();
  for (const p of await listAllPaged("identity", "/api/v1/persons")) {
    M.persons.set(p.documentNumber, p.personId);
    existingPersons.set(p.documentNumber, p);
  }
  for (const u of await listAllPaged("identity", "/api/v1/users")) M.users.set(u.username, u.userId);

  const personJobs = [
    ...PEOPLE.map((p) => p),
    ...STAFF.map((s) => s),
    ...SCHOOL_ADMINS,
    ...STUDENTS,
    ...TEACHERS,
  ];
  const tick = progress(personJobs.length, 400, "persons");
  await pooled(personJobs, CONCURRENCY, async (p) => {
    await upsert("identity", "/api/v1/persons", personBody(p), {
      idKeys: ["personId", "id"], map: M.persons, mapKey: p.documentNumber,
      matchKey: "documentNumber", matchValue: p.documentNumber,
      fetchList: () => listAllPaged("identity", "/api/v1/persons"),
    });
    tick();
  });
  // upsert() devuelve el id y no toca la fila si ya existia, asi que en una base
  // ya sembrada los atributos nuevos jamas llegarian. Se completan con PUT, y solo
  // a quien le falte algo: en una base al dia este paso no hace ni una peticion.
  const needsBackfill = (p) => {
    const row = existingPersons.get(p.documentNumber);
    if (!row) return false;
    return ['email', 'phone', 'address', 'birthDate', 'bloodType'].some((k) => p[k] && !row[k]);
  };
  const backfill = personJobs.filter(needsBackfill);
  if (backfill.length) {
    const tickFill = progress(backfill.length, 400, "person backfill");
    await pooled(backfill, CONCURRENCY, async (p) => {
      const id = M.persons.get(p.documentNumber);
      if (id) await call("identity", "PUT", "/api/v1/persons/" + id, personBody(p), true);
      tickFill();
    });
  }

  ids.personIds = PEOPLE.map((p) => M.persons.get(p.documentNumber)).filter(Boolean);
  ids.staffPersonIds = {};
  for (const s of STAFF) ids.staffPersonIds[s.key] = M.persons.get(s.documentNumber) ?? null;

  // POST /api/v1/users requires personId + username + password; the password is
  // bcrypt-hashed server side (ADR-008) and never returned by any endpoint.
  // Admin reuses SEED_USERNAME so existing smoke tests keep working.
  const logins = [
    { key: "userId", personId: ids.staffPersonIds.admin, username: SEED_USERNAME, password: SEED_PASSWORD },
    { key: "instructorUserId", personId: ids.staffPersonIds.instructor, username: INSTRUCTOR_USERNAME, password: INSTRUCTOR_PASSWORD },
    { key: "studentUserId", personId: ids.personIds[0] ?? null, username: STUDENT_USERNAME, password: STUDENT_PASSWORD },
    ...SCHOOL_ADMINS.map((a) => ({ personId: M.persons.get(a.documentNumber), username: a.username, password: SCHOOL_ADMIN_PASSWORD })),
    // Un estudiante con login por sede, tomado de los ya sembrados.
    ...STUDENT_LOGINS.map((l) => ({
      personId: M.persons.get(STUDENTS.find((s) => s.schoolIdx === l.schoolIdx).documentNumber),
      username: l.username,
      password: STUDENT_PASSWORD,
    })),
    ...TEACHERS.map((t) => ({ personId: M.persons.get(t.documentNumber), username: t.username, password: TEACHER_PASSWORD })),
  ];
  const tickUsers = progress(logins.length, 40, "users");
  await pooled(logins, CONCURRENCY, async (l) => {
    if (!l.personId) {
      console.log(`skip  - user ${l.username} needs a person id (identity person seed failed?)`);
      return;
    }
    const userId = await upsert("identity", "/api/v1/users", { personId: l.personId, username: l.username, password: l.password }, {
      idKeys: ["userId", "id"], map: M.users, mapKey: l.username,
      matchKey: "username", matchValue: l.username,
      fetchList: () => listAllPaged("identity", "/api/v1/users"),
    });
    if (userId && l.key) ids[l.key] = userId;
    tickUsers();
  });
  await get("identity", `/api/v1/auth/me?username=${SEED_USERNAME}`);
  await get("identity", `/api/v1/auth/me?username=${INSTRUCTOR_USERNAME}`);
  await get("identity", `/api/v1/auth/me?username=${STUDENT_USERNAME}`);
  done();
}

// Authorization: canonical Mobile roles (Administrador, Instructor, Aprendiz)
// plus the explicit global Super Administrador (007-split-super-admin-role).
// Each demo login gets its role so role-guarded logins resolve correctly.
// Every seeded teacher also gets Instructor so the role holds at volume.
async function seedAuthorization() {
  const done = banner("authorization");
  for (const r of asArray(await get("authorization", "/api/v1/roles"))) {
    M.roles.set(r.roleName, pick(r, "roleId", "id"));
  }
  const roleFor = async (roleName, description) => upsert("authorization", "/api/v1/roles",
    { roleName, description },
    { idKeys: ["roleId", "id"], map: M.roles, mapKey: roleName, matchKey: "roleName", matchValue: roleName, fetchList: () => get("authorization", "/api/v1/roles") });
  const adminRoleId = await roleFor("Administrador", "Rol Mobile: acceso total");
  const superAdminRoleId = await roleFor("Super Administrador", "Rol Web: administrador global sin sede");
  const instructorRoleId = await roleFor("Instructor", "Rol Mobile: docencia y asistencia");
  const aprendizRoleId = await roleFor("Aprendiz", "Rol Mobile: consulta propia");
  ids.roleId = adminRoleId;
  await post("authorization", "/api/v1/permissions", { permissionName: "seed.attendance.read", description: "Read attendance" });
  await post("authorization", "/api/v1/permissions", { permissionName: "seed.attendance.write", description: "Write attendance" });
  const assignments = [
    { userId: ids.userId, roleId: superAdminRoleId },
    { userId: ids.instructorUserId, roleId: instructorRoleId },
    { userId: ids.studentUserId, roleId: aprendizRoleId },
    ...SCHOOL_ADMINS.map((a) => ({ userId: M.users.get(a.username), roleId: adminRoleId, label: a.username })),
    ...STUDENT_LOGINS.map((l) => ({ userId: M.users.get(l.username), roleId: aprendizRoleId, label: l.username })),
    ...TEACHERS.map((t) => ({ userId: M.users.get(t.username), roleId: instructorRoleId, label: t.username })),
  ];
  const tick = progress(assignments.length, 40, "role assignments");
  await pooled(assignments, CONCURRENCY, async (a) => {
    if (a.userId && a.roleId) await post("authorization", `/api/v1/users/${a.userId}/roles`, { roleId: a.roleId });
    else console.log(`skip  - role assignment needs a user id and role id${a.label ? ` (${a.label})` : ""}`);
    tick();
  });
  await get("authorization", "/api/v1/roles");
  done();
}

// Academic: schools (2 new + legacy disabled) -> programs -> periods ->
// cohorts (6 grades x 2 tracks) -> courses -> actors (1600 + 80) -> enrollments.
async function seedAcademic() {
  const done = banner("academic");
  const existingEnrollments = [];
  const loadIndexes = async () => {
    for (const s of await listPaged("academic", "/api/v1/schools")) M.schools.set(s.code, s);
    for (const p of await listPaged("academic", "/api/v1/programs")) M.programs.set(`${p.schoolId}:${p.code}`, p.programId);
    for (const p of await listPaged("academic", "/api/v1/academic-periods")) M.periods.set(`${p.schoolId}:${p.name}`, p.academicPeriodId);
    for (const c of await listPaged("academic", "/api/v1/cohorts")) M.cohorts.set(c.code, c.cohortId);
    for (const c of await listPaged("academic", "/api/v1/courses")) M.courses.set(`${c.programId}:${c.code}`, c.courseId);
    for (const a of await listPaged("academic", "/api/v1/academic-actors")) M.actors.set(a.actorCode, a.academicActorId);
    for (const e of await listPaged("academic", "/api/v1/enrollments")) {
      M.enrollments.add(`${e.academicActorId}:${e.cohortId}`);
      existingEnrollments.push(e);
    }
  };
  await loadIndexes();

  // The demo institutions from the previous seed go dormant (soft disable, no
  // deletion): school pickers then show exactly the 2 active institutions.
  for (const code of LEGACY_SCHOOL_CODES) {
    const s = M.schools.get(code);
    if (s && s.status !== false) await patch("academic", `/api/v1/schools/${s.schoolId}/status`, { status: false });
  }

  ids.schoolIds = [];
  for (const s of SCHOOLS) {
    let school = M.schools.get(s.code);
    if (!school) {
      const created = await post("academic", "/api/v1/schools", {
        code: s.code, name: s.name, cityId: ids.cityId ?? 1, cityName: s.city,
      });
      if (created) { school = created; M.schools.set(s.code, created); }
    }
    ids.schoolIds.push(school ? pick(school, "schoolId", "id") : null);
  }

  for (let schoolIdx = 0; schoolIdx < SCHOOLS.length; schoolIdx++) {
    const schoolId = ids.schoolIds[schoolIdx];
    if (schoolId == null) continue;
    for (const pr of PROGRAMS) {
      await upsert("academic", "/api/v1/programs", { schoolId, code: pr.code, name: pr.name }, {
        idKeys: ["programId", "id"], map: M.programs, mapKey: `${schoolId}:${pr.code}`,
        matchKey: "code", matchValue: pr.code,
        fetchList: () => listPaged("academic", "/api/v1/programs"),
      });
    }
    await upsert("academic", "/api/v1/academic-periods", {
      schoolId, name: "Periodo Académico 2026-II", startsOn: WINDOW_START, endsOn: PERIOD_END, isActive: true,
    }, {
      idKeys: ["academicPeriodId", "id"], map: M.periods, mapKey: `${schoolId}:Periodo Académico 2026-II`,
      matchKey: "name", matchValue: "Periodo Académico 2026-II",
      fetchList: () => listPaged("academic", "/api/v1/academic-periods"),
    });
    const periodId = M.periods.get(`${schoolId}:Periodo Académico 2026-II`);
    for (let cohortIdx = 0; cohortIdx < COHORTS_PER_SCHOOL; cohortIdx++) {
      const code = cohortCodeOf(schoolIdx, cohortIdx);
      const programId = M.programs.get(`${schoolId}:${PROGRAMS[cohortIdx % 2].code}`);
      if (programId == null || periodId == null) continue;
      await upsert("academic", "/api/v1/cohorts", { programId, academicPeriodId: periodId, code }, {
        idKeys: ["cohortId", "id"], map: M.cohorts, mapKey: code,
        matchKey: "code", matchValue: code,
        fetchList: () => listPaged("academic", "/api/v1/cohorts"),
      });
    }
    for (const pr of PROGRAMS) {
      const programId = M.programs.get(`${schoolId}:${pr.code}`);
      if (programId == null) continue;
      for (const sub of SUBJECTS) {
        await upsert("academic", "/api/v1/courses", { programId, code: sub.code, name: sub.name, creditHours: sub.creditHours }, {
          idKeys: ["courseId", "id"], map: M.courses, mapKey: `${programId}:${sub.code}`,
          matchKey: "code", matchValue: sub.code,
          fetchList: () => listPaged("academic", "/api/v1/courses"),
        });
      }
    }
  }

  // ADMIN como tercer tipo de actor: un administrador de sede es un rol distinto
  // del de docente, y modelarlo como INSTRUCTOR lo mezclaba con la planta docente.
  const actorTypes = asArray(await get("academic", "/api/v1/actor-types"));
  let adminActorTypeId = actorTypes.find((t) => t?.code === "ADMIN")?.actorTypeId;
  if (adminActorTypeId == null) {
    const created = await post("academic", "/api/v1/actor-types", { code: "ADMIN", name: "Administrador de sede" });
    adminActorTypeId = created ? pick(created, "actorTypeId", "id") : null;
  }
  if (adminActorTypeId == null) console.log("skip  - no ADMIN actor type: school admins will have no school");

  // academic_actor.person_id is a native UUID column (cross-context reference to
  // identity.person, no FK): it must be the UUID from seedIdentity(), not the
  // biometric string id (which lives only in MongoDB).
  const actorJobs = [
    ...STUDENTS.map((s) => ({ personKey: s.documentNumber, actorTypeId: 1, schoolIdx: s.schoolIdx, actorCode: s.actorCode })),
    ...TEACHERS.map((t) => ({ personKey: t.documentNumber, actorTypeId: 2, schoolIdx: t.schoolIdx, actorCode: t.actorCode })),
    ...(adminActorTypeId == null ? [] : SCHOOL_ADMINS.map((a) => ({
      personKey: a.documentNumber, actorTypeId: adminActorTypeId, schoolIdx: a.schoolIdx, actorCode: a.actorCode,
    }))),
  ].filter((a) => M.persons.get(a.personKey) && ids.schoolIds[a.schoolIdx] != null);
  const tickActors = progress(actorJobs.length, 400, "actors");
  await pooled(actorJobs, CONCURRENCY, async (a) => {
    await upsert("academic", "/api/v1/academic-actors", {
      personId: M.persons.get(a.personKey), actorTypeId: a.actorTypeId,
      schoolId: ids.schoolIds[a.schoolIdx], actorCode: a.actorCode, startedOn: WINDOW_START,
    }, {
      idKeys: ["academicActorId", "id"], map: M.actors, mapKey: a.actorCode,
      matchKey: "actorCode", matchValue: a.actorCode,
      fetchList: () => listPaged("academic", "/api/v1/academic-actors"),
    });
    tickActors();
  });
  // Los actores de corridas viejas se desactivan (soft delete), no se borran: sin
  // esto SEED-STU-01 seguia apareciendo como el primer estudiante de la lista.
  for (const code of LEGACY_ACTOR_CODES) {
    const id = M.actors.get(code);
    if (id != null) await call("academic", "PATCH", "/api/v1/academic-actors/" + id + "/status", { status: false }, true);
  }
  // upsert() devuelve el actor existente sin tocarlo, así que los administradores
  // sembrados por una corrida anterior (o dejados en INSTRUCTOR por la reversión)
  // se corrigen aquí al tipo ADMIN.
  if (adminActorTypeId != null) {
    for (const a of SCHOOL_ADMINS) {
      const actorId = M.actors.get(a.actorCode);
      if (actorId != null) {
        await call("academic", "PUT", "/api/v1/academic-actors/" + actorId, { actorTypeId: adminActorTypeId }, true);
      }
    }
  }

  // Roster per cohort feeds roll call (attendance) and blocks (scheduling).
  ids.rosterByCohort = new Map();
  for (const s of STUDENTS) {
    const actorId = M.actors.get(s.actorCode);
    if (actorId == null) continue;
    const roster = ids.rosterByCohort.get(s.cohortCode) ?? [];
    roster.push(actorId);
    ids.rosterByCohort.set(s.cohortCode, roster);
  }

  const enrollmentJobs = [];
  for (const s of STUDENTS) {
    const actorId = M.actors.get(s.actorCode);
    const cohortId = M.cohorts.get(s.cohortCode);
    if (actorId == null || cohortId == null) continue;
    const key = `${actorId}:${cohortId}`;
    if (M.enrollments.has(key)) continue;
    enrollmentJobs.push({ actorId, cohortId, key });
  }
  // Antes las 1607 matrículas quedaban en "Active", así que filtrar por
  // enrollmentStatus devolvía siempre la lista completa. Se reparten: ~3%
  // retiradas y ~2% completadas, el resto activas.
  const enrollmentStatusFor = (i) => (i % 33 === 7 ? "Withdrawn" : i % 53 === 11 ? "Completed" : "Active");
  const tickEnr = progress(enrollmentJobs.length, 400, "enrollments");
  await pooled(enrollmentJobs, CONCURRENCY, async (e, i) => {
    await post("academic", "/api/v1/enrollments", {
      academicActorId: e.actorId, cohortId: e.cohortId, enrolledOn: WINDOW_START,
      enrollmentStatus: enrollmentStatusFor(i),
    });
    M.enrollments.add(e.key);
    tickEnr();
  });

  // Las matriculas creadas en corridas anteriores ya existen, y el bucle de arriba
  // las salta, asi que en una base sembrada seguian todas en "Active". Se reparte
  // el estado tambien sobre esas, con la misma proporcion.
  const stale = existingEnrollments
    .map((e, i) => ({ id: pick(e, "enrollmentId", "id"), current: e.enrollmentStatus, wanted: enrollmentStatusFor(i) }))
    .filter((e) => e.id != null && e.wanted !== e.current && e.current === "Active");
  if (stale.length) {
    const tickFix = progress(stale.length, 50, "enrollment states");
    await pooled(stale, CONCURRENCY, async (e) => {
      await call("academic", "PATCH", "/api/v1/enrollments/" + e.id + "/status", { enrollmentStatus: e.wanted }, true);
      tickFix();
    });
  }
  // Cohort descriptors consumed by scheduling (blocks + sessions).
  ids.cohorts = [];
  for (let schoolIdx = 0; schoolIdx < SCHOOLS.length; schoolIdx++) {
    for (let cohortIdx = 0; cohortIdx < COHORTS_PER_SCHOOL; cohortIdx++) {
      const code = cohortCodeOf(schoolIdx, cohortIdx);
      ids.cohorts.push({
        code, id: M.cohorts.get(code), schoolIdx, track: cohortIdx % 2, local: cohortIdx,
      });
    }
  }
  ids.teacherActorIdsBySchool = [0, 1].map((schoolIdx) =>
    TEACHERS.filter((t) => t.schoolIdx === schoolIdx).map((t) => M.actors.get(t.actorCode)).filter((v) => v != null));

  await get("academic", "/api/v1/schools");
  const firstCohort = ids.cohorts.find((c) => c.id != null);
  if (firstCohort) await get("academic", `/api/v1/cohorts/${firstCohort.id}/enrollments`);
  done();
}

// Occurrences of an ISO weekday inside the pinned window (Mon 2026-09-07 ..
// Mon 2026-10-05): 5 dates for Mondays, 4 for the other weekdays.
function sessionDatesFor(dayOfWeek) {
  const dates = [];
  const start = Date.parse(`${WINDOW_START}T00:00:00Z`);
  const end = Date.parse(`${SEED_TODAY}T00:00:00Z`);
  const startDow = new Date(start).getUTCDay() || 7;
  let d = start + ((dayOfWeek - startDow + 7) % 7) * 86400000;
  for (; d <= end; d += 7 * 86400000) dates.push(new Date(d).toISOString().slice(0, 10));
  return dates;
}

// Scheduling: environments (12 per school) -> blocks (12 per cohort) ->
// sessions (4-5 per block over the window) -> past Closed, today Open.
async function seedScheduling() {
  const done = banner("scheduling");
  for (const e of asArray(await get("scheduling", "/api/v1/environments"))) {
    M.envs.set(`${e.schoolId}:${e.code}`, pick(e, "environmentId", "id"));
  }
  // 04 list endpoints take filters but no limit/offset: a bare GET returns all.
  for (const b of asArray(await get("scheduling", "/api/v1/schedule-blocks"))) {
    M.blocks.set(`${b.cohortId}:${b.courseId}`, pick(b, "scheduleBlockId", "id"));
  }

  const envCodes = [];
  for (let schoolIdx = 0; schoolIdx < SCHOOLS.length; schoolIdx++) {
    const schoolId = ids.schoolIds[schoolIdx];
    const prefix = SCHOOLS[schoolIdx].prefix;
    const schoolEnvs = [
      ...Array.from({ length: 10 }, (_, n) => ({ code: `AULA-${prefix}-${pad2(n + 1)}`, name: `Aula ${n + 1}`, capacity: 70 })),
      { code: `LAB-INFO-${prefix}`, name: "Laboratorio de Informática", capacity: 45 },
      { code: `LAB-CIEN-${prefix}`, name: "Laboratorio de Ciencias", capacity: 45 },
    ];
    const tickEnv = progress(schoolEnvs.length, 12, "environments");
    for (const env of schoolEnvs) {
      if (schoolId != null) {
        await upsert("scheduling", "/api/v1/environments", { schoolId, code: env.code, name: env.name, capacity: env.capacity }, {
          idKeys: ["environmentId", "id"], map: M.envs, mapKey: `${schoolId}:${env.code}`,
          matchKey: "code", matchValue: env.code,
          fetchList: () => get("scheduling", "/api/v1/environments"),
        });
      }
      tickEnv();
    }
    envCodes.push(schoolEnvs.map((e) => (schoolId != null ? M.envs.get(`${schoolId}:${e.code}`) : null)));
  }

  // Deterministic weekly grid: 12 two-hour slots per cohort (phase-shifted so a
  // cohort never clashes with itself), one home room per cohort, instructors
  // assigned greedily so no teacher gets two blocks at the same slot.
  const busy = new Set();
  const blockDescs = [];
  for (const coh of ids.cohorts) {
    if (coh.id == null) continue;
    const schoolId = ids.schoolIds[coh.schoolIdx];
    const programId = M.programs.get(`${schoolId}:${PROGRAMS[coh.track].code}`);
    const environmentId = envCodes[coh.schoolIdx]?.[coh.local] ?? null;
    const teachers = ids.teacherActorIdsBySchool[coh.schoolIdx] ?? [];
    if (environmentId == null || !teachers.length) {
      console.log(`skip  - blocks for cohort ${coh.code} need an environment and an instructor`);
      continue;
    }
    for (let b = 0; b < SUBJECTS.length; b++) {
      const slot = (b + coh.local * 5) % SLOT_COUNT;
      const dayOfWeek = Math.floor(slot / 6) + 1;
      const startH = START_HOURS[slot % 6];
      const courseId = M.courses.get(`${programId}:${SUBJECTS[b].code}`);
      if (courseId == null) continue;
      let teacher = teachers.find((t) => !busy.has(`${t}:${slot}`));
      if (teacher == null) teacher = teachers[b % teachers.length];
      busy.add(`${teacher}:${slot}`);
      blockDescs.push({
        mapKey: `${coh.id}:${courseId}`, cohortCode: coh.code, dayOfWeek,
        instructorActorId: teacher,
        body: {
          cohortId: coh.id, courseId, environmentId, instructorActorId: teacher,
          dayOfWeek, startsAt: `${pad2(startH)}:00:00`, endsAt: `${pad2(startH + 2)}:00:00`,
        },
      });
    }
  }
  const missingBlocks = blockDescs.filter((d) => !M.blocks.has(d.mapKey));
  const tickBlocks = progress(missingBlocks.length, 60, "blocks");
  await pooled(missingBlocks, CONCURRENCY, async (d) => {
    await upsert("scheduling", "/api/v1/schedule-blocks", d.body, {
      idKeys: ["scheduleBlockId", "id"], map: M.blocks, mapKey: d.mapKey,
      matchKey: "environmentId", matchValue: d.body.environmentId,
      fetchList: () => get("scheduling", "/api/v1/schedule-blocks"),
    });
    tickBlocks();
  });

  // Sessions: one list per block, create the missing dates, then enforce the
  // status policy (past Closed with the block's instructor, SEED_TODAY Open).
  ids.sessionCtx = [];
  const sessionJobs = blockDescs.map((d) => ({ ...d, blockId: M.blocks.get(d.mapKey), dates: sessionDatesFor(d.dayOfWeek) })).filter((j) => j.blockId != null);
  const tickSessions = progress(sessionJobs.length, 100, "blocks w/ sessions");
  await pooled(sessionJobs, CONCURRENCY, async (job) => {
    const listPath = `/api/v1/class-sessions?scheduleBlockId=${job.blockId}`;
    const existing = asArray(await get("scheduling", listPath));
    const byDate = new Map(existing.map((s) => [String(s.sessionDate ?? s.session_date ?? "").slice(0, 10), s]));
    for (const date of job.dates) {
      let row = byDate.get(date);
      let sid = row ? pick(row, "sessionId", "classSessionId", "id") : null;
      if (sid == null) {
        const created = await post("scheduling", "/api/v1/class-sessions", { scheduleBlockId: job.blockId, sessionDate: date });
        sid = created ? pick(created, "sessionId", "classSessionId", "id") : null;
        if (sid != null) row = created;
        else { // 409: resolve the existing session so the chain keeps working
          row = asArray(await get("scheduling", listPath)).find((s) =>
            String(s.sessionDate ?? s.session_date ?? "").slice(0, 10) === date);
          sid = row ? pick(row, "sessionId", "classSessionId", "id") : null;
        }
      }
      if (sid == null) continue;
      const status = pick(row, "sessionStatus", "session_status", "status");
      if (date !== SEED_TODAY && status !== "Closed") {
        await post("scheduling", `/api/v1/class-sessions/${sid}/close`, { closedBy: job.instructorActorId });
      } else if (date === SEED_TODAY && status !== "Open") {
        await post("scheduling", `/api/v1/class-sessions/${sid}/open`);
      }
      ids.sessionCtx.push({ id: sid, cohortCode: job.cohortCode, date });
    }
    tickSessions();
  });
  await get("scheduling", "/api/v1/environments");
  done();
}

// Attendance: roll call per session (bulk, ~81k records) plus justifications
// over a deterministic sample of absences.
async function seedAttendance() {
  const done = banner("attendance");
  for (const jt of asArray(await get("attendance", "/api/v1/justification-types"))) {
    M.justTypes.set(jt.name, pick(jt, "justificationTypeId", "id"));
  }
  const typeDefs = [
    { name: "Incapacidad médica EPS", description: "Excusa médica certificada por la EPS", requiresAttachment: true },
    { name: "Calamidad doméstica", description: "Calamidad doméstica debidamente soportada", requiresAttachment: true },
    { name: "Compromiso deportivo institucional", description: "Representación institucional en eventos deportivos", requiresAttachment: false },
  ];
  const tickTypes = progress(typeDefs.length, 3, "justification types");
  for (const t of typeDefs) {
    await upsert("attendance", "/api/v1/justification-types", t, {
      idKeys: ["justificationTypeId", "id"], map: M.justTypes, mapKey: t.name,
      matchKey: "name", matchValue: t.name,
      fetchList: () => get("attendance", "/api/v1/justification-types"),
    });
    tickTypes();
  }
  // Tipos de corridas viejas: se desactivan para que el selector muestre los
  // tres vigentes y no ocho filas para los mismos tres conceptos.
  for (const name of LEGACY_JUSTIFICATION_TYPES) {
    const id = M.justTypes.get(name);
    if (id != null) await call("attendance", "PUT", "/api/v1/justification-types/" + id, { status: false }, true);
  }

  // Regla ISO-8.2-VAL-001 (AGENTS.md §6.5): un tipo con requiresAttachment no
  // puede pasar a Approved sin al menos un supporting_document. El backend
  // respondia 400 correctamente y el seed aprobaba a ciegas (95 FAIL/corrida):
  // ahora se sube el soporte antes de aprobar.
  const requiresDocTypeIds = new Set(
    typeDefs
      .filter((t) => t.requiresAttachment)
      .map((t) => M.justTypes.get(t.name))
      .filter((v) => v != null),
  );
  const attachSupportingDoc = (jid) =>
    post("attendance", "/api/v1/supporting-documents", {
      justificationId: jid,
      fileName: `soporte-${jid}.pdf`,
      storageUri: `seed://justifications/${jid}/soporte.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 2048,
    });

  const existingJustifications = [];
  for (const j of asArray(await get("attendance", "/api/v1/justifications"))) {
    const rid = pick(j, "attendanceRecordId", "attendance_record_id");
    if (rid != null) M.justifications.add(String(rid));
    existingJustifications.push(j);
  }

  // attendance_status is the native enum ('Present','Absent','Late','Justified') and
  // capture_method is ('FACIAL','MANUAL','IOT','IMPORT'); casing must match exactly.
  const tickBulk = progress(ids.sessionCtx.length, 200, "roll calls");
  await pooled(ids.sessionCtx, CONCURRENCY, async (job) => {
    const roster = ids.rosterByCohort.get(job.cohortCode) ?? [];
    if (roster.length) {
      const sIdx = Number(job.id) % 97; // stable per session: rerun-free random-looking rotation
      const body = roster.map((academicActorId, i) => {
        const r = (i * 7 + sIdx * 13) % 100;
        const attendanceStatus = r < 80 ? "Present" : r < 88 ? "Late" : "Absent";
        const m = (i * 3 + sIdx) % 10;
        // Un ausente no pasa por el lector: marcarlo FACIAL con match_score dejaba
        // 5.800 registros diciendo que la cámara reconoció a quien no vino. La
        // ausencia la registra el docente (MANUAL) o llega por importación.
        const captureMethod = attendanceStatus === "Absent"
          ? (m < 7 ? "MANUAL" : "IMPORT")
          : (m < 6 ? "FACIAL" : m < 8 ? "MANUAL" : m < 9 ? "IOT" : "IMPORT");
        const rec = { classSessionId: job.id, academicActorId, attendanceStatus, captureMethod };
        // El score solo existe si hubo comparación biométrica real.
        if (captureMethod === "FACIAL") rec.matchScore = +(((i * 37 + sIdx * 11) % 24 + 76) / 100).toFixed(4);
        return rec;
      });
      await post("attendance", "/api/v1/attendance-records/bulk", body);
    }
    tickBulk();
  });

  // Notas de resolucion: dan contenido distinto a cada expediente revisado.
  const APPROVAL_NOTES = [
    "Soporte medico verificado con la EPS; inasistencia justificada.",
    "Certificado adjunto coincide con la fecha de la sesion.",
    "Calamidad confirmada con acudiente por via telefonica.",
    "Permiso institucional avalado por coordinacion academica.",
  ];
  const REJECTION_NOTES = [
    "Sin soporte adjunto dentro del plazo de tres dias habiles.",
    "La fecha del certificado no corresponde a la sesion reportada.",
    "El tipo de justificacion exige anexo y no se recibio.",
  ];
  // 1 de cada 8 sesiones recibe hasta 2 ausencias justificadas; una parte se revisa.
  const reasons = [
    "Cita médica EPS programada con anterioridad",
    "Incapacidad certificada por el médico particular",
    "Emergencia familiar grave el día de la sesión",
    "Traslado de ciudad por causas familiares",
    "Malestar general manifestado la noche anterior",
  ];
  const typeSlots = typeDefs
    .map((t) => ({ id: M.justTypes.get(t.name), requiresDoc: t.requiresAttachment }))
    .filter((t) => t.id != null);
  const targets = [...ids.sessionCtx].sort((a, b) => a.id - b.id).filter((_, i) => i % 8 === 0);
  const tickJust = progress(targets.length, 50, "justified sessions");
  await pooled(targets, CONCURRENCY, async (job, ti) => {
    const recs = asArray(await get("attendance", `/api/v1/class-sessions/${job.id}/attendance`));
    const absent = recs.filter((r) => pick(r, "attendanceStatus", "attendance_status") === "Absent").slice(0, 2);
    let k = 0;
    for (const rec of absent) {
      const rid = pick(rec, "attendanceRecordId", "recordId", "id");
      if (rid == null || M.justifications.has(String(rid))) continue;
      const slotType = typeSlots[(ti + k) % typeSlots.length];
      const created = await post("attendance", "/api/v1/justifications", {
        attendanceRecordId: rid,
        justificationTypeId: slotType.id,
        reason: reasons[(ti + k) % reasons.length],
      });
      M.justifications.add(String(rid));
      // Antes TODAS quedaban en Pending: la bandeja de revision no tenia ni un
      // caso resuelto y filtrar por reviewStatus devolvia siempre lo mismo.
      // Reparto: ~45% aprobadas, ~20% rechazadas, el resto pendientes.
      const jid = created ? pick(created, "justificationId", "id") : null;
      const slot = (ti + k) % 20;
      if (jid != null && ids.userId && slot < 13) {
        const approved = slot < 9;
        if (approved && slotType.requiresDoc) await attachSupportingDoc(jid);
        await call("attendance", "PATCH", "/api/v1/justifications/" + jid + "/review", {
          reviewStatus: approved ? "Approved" : "Rejected",
          reviewedBy: ids.userId,
          resolutionNotes: approved
            ? APPROVAL_NOTES[(ti + k) % APPROVAL_NOTES.length]
            : REJECTION_NOTES[(ti + k) % REJECTION_NOTES.length],
        });
      }
      k++;
    }
    tickJust();
  });
  // Las justificaciones de corridas anteriores ya existen y el bucle de arriba las
  // salta, asi que en una base sembrada seguian todas en Pending. Se les aplica el
  // mismo reparto para que la bandeja tenga historial desde la primera consulta.
  const unreviewed = existingJustifications
    .map((j, i) => ({
      id: pick(j, "justificationId", "id"),
      status: pick(j, "reviewStatus", "review_status"),
      typeId: pick(j, "justificationTypeId", "justification_type_id"),
      slot: i % 20,
    }))
    .filter((j) => j.id != null && j.status === "Pending" && j.slot < 13);
  if (unreviewed.length && ids.userId) {
    const tickRev = progress(unreviewed.length, 50, "justification reviews");
    await pooled(unreviewed, CONCURRENCY, async (j, i) => {
      const approved = j.slot < 9;
      if (approved && requiresDocTypeIds.has(j.typeId)) await attachSupportingDoc(j.id);
      await call("attendance", "PATCH", "/api/v1/justifications/" + j.id + "/review", {
        reviewStatus: approved ? "Approved" : "Rejected",
        reviewedBy: ids.userId,
        resolutionNotes: approved
          ? APPROVAL_NOTES[i % APPROVAL_NOTES.length]
          : REJECTION_NOTES[i % REJECTION_NOTES.length],
      }, true);
      tickRev();
    });
  }
  done();
}

// Biometric: facial enroll for the whole roster (student + teacher person
// UUIDs), plus the legacy string-id demo block kept for old dashboards.
async function seedBiometric() {
  const done = banner("biometric");
  const base = [0.12, 0.45, 0.78, 0.23, 0.56, 0.89, 0.34, 0.67];
  const encodingFor = (i) => base.map((v, j) => +(v + (i % 100) * 0.01 + j * 0.001).toFixed(4));
  // Legacy id kept for backward compatibility with existing frontends/dashboards.
  await post("biometric", "/api/v1/biometric/facial/enroll", {
    person_id: "seed-student-01", encoding: base, model_version: "seed-v1",
  });
  for (let i = 0; i < PEOPLE.length; i++) {
    await post("biometric", "/api/v1/biometric/facial/enroll", {
      person_id: PEOPLE[i].biometricId, encoding: encodingFor(i), model_version: "seed-v1",
    });
  }
  const first = PEOPLE[0].biometricId;
  await post("biometric", "/api/v1/biometric/facial/verify", { person_id: first, encoding: encodingFor(0) });
  await post("biometric", "/api/v1/biometric/facial/identify", { encoding: encodingFor(0) });
  await get("biometric", `/api/v1/biometric/facial/${first}/history`);

  const enrollJobs = [
    ...STUDENTS.map((s, i) => ({ personId: M.persons.get(s.documentNumber), seq: i })),
    ...TEACHERS.map((t, i) => ({ personId: M.persons.get(t.documentNumber), seq: 1000 + i })),
  ].filter((j) => j.personId != null);
  const tick = progress(enrollJobs.length, 400, "enrolls");
  await pooled(enrollJobs, CONCURRENCY, async (j) => {
    const active = await getProbe("biometric", `/api/v1/biometric/facial/${j.personId}`);
    if (!active) { // null = 404, person not enrolled yet
      await post("biometric", "/api/v1/biometric/facial/enroll", {
        person_id: j.personId, encoding: encodingFor(j.seq), model_version: "seed-v1",
      });
    }
    tick();
  });
  done();
}

// Configuration: per-school attendance configs, security configs and a top-up
// of pending biometric update cases (capped at 10 pending).
async function seedConfiguration() {
  const done = banner("configuration");
  const academicConfigs = [
    ["attendance.tolerance.minutes", "10"],
    ["attendance.absence.alert.threshold", "3"],
    ["attendance.min.passing.percent", "80"],
  ];
  const jobs = [];
  for (const schoolId of ids.schoolIds) {
    if (schoolId == null) continue;
    for (const [configurationName, configurationValue] of academicConfigs) {
      jobs.push({ schoolId, configurationName, configurationValue });
    }
  }
  const tick = progress(jobs.length, 6, "academic configs");
  await pooled(jobs, CONCURRENCY, async (c) => {
    await post("configuration", "/api/v1/configurations/academic", {
      schoolId: c.schoolId, configurationName: c.configurationName, configurationValue: c.configurationValue,
    });
    tick();
  });
  for (const [configurationName, configurationValue] of [
    ["jwt.ttl.seconds", "3600"],
    ["session.timeout.minutes", "480"],
    ["login.max.attempts", "5"],
  ]) {
    await post("configuration", "/api/v1/configurations/security", { configurationName, configurationValue });
  }

  const pending = asArray(await get("configuration", "/api/v1/biometric-update-cases?status=Pending"));
  for (const c of pending) {
    const pid = pick(c, "personId", "person_id");
    if (pid != null) M.updateCases.add(String(pid));
  }
  const caseReasons = [
    "Re-enrolamiento por actualización de documento",
    "Cambio de plantilla facial por nuevo modelo",
    "Corrección de enrolamiento por baja calidad de la muestra",
  ];
  let pendingCount = pending.length;
  for (const idx of [99, 199, 299, 399, 499, 599, 699, 799, 899, 999]) {
    if (pendingCount >= 10) break;
    const pid = M.persons.get(STUDENTS[idx]?.documentNumber);
    if (!pid || M.updateCases.has(String(pid))) continue;
    await post("configuration", "/api/v1/biometric-update-cases", {
      personId: pid, biometricType: "FACIAL", reason: caseReasons[idx % caseReasons.length],
    });
    M.updateCases.add(String(pid));
    pendingCount++;
  }
  await get("configuration", "/api/v1/biometric-update-cases?status=Pending");
  done();
}

// Notification: 3 alert types, then one alert per absentee/tardy/low-attendance
// student rule (~467 alerts). Alerts carry no unique key, so the existing
// collection is indexed first to keep reruns from duplicating them.
async function seedNotification() {
  const done = banner("notification");
  for (const t of await listPaged("notification", "/api/v1/alert-types")) {
    M.alertTypes.set(pick(t, "Code", "code"), pick(t, "AlertTypeID", "alertTypeId", "id"));
  }
  // Los codigos son los del catalogo que ya siembra Liquibase (SEEDS.md 7).
  // Antes el seed creaba ABSENTEEISM / TARDINESS / LOW_ATTENDANCE por su cuenta:
  // /alert-types devolvia 9 tipos, tres duplicados y los cinco oficiales a cero.
  const typeDefs = [
    { code: "ATTENDANCE_ABSENTEEISM", name: "Inasistencia recurrente", severity: "WARNING", channel: "DASHBOARD" },
    { code: "ATTENDANCE_TARDINESS", name: "Tardanzas repetidas", severity: "INFO", channel: "DASHBOARD" },
    { code: "ATTENDANCE_LOW", name: "Bajo porcentaje de asistencia", severity: "WARNING", channel: "DASHBOARD" },
  ];
  for (const t of typeDefs) {
    if (M.alertTypes.has(t.code)) continue;
    const created = await post("notification", "/api/v1/alert-types", t);
    const id = created ? pick(created, "AlertTypeID", "alertTypeId", "id") : null;
    if (id != null) M.alertTypes.set(t.code, id);
  }
  const existingAlerts = [];
  for (const a of await listPaged("notification", "/api/v1/alerts")) {
    M.alerts.add(`${pick(a, "AcademicActorID", "academic_actor_id")}:${pick(a, "AlertTypeID", "alert_type_id")}`);
    existingAlerts.push(a);
  }

  const alertJobs = [];
  for (const s of STUDENTS) {
    const actorId = M.actors.get(s.actorCode);
    if (actorId == null) continue;
    const rules = [
      ...(s.seq % 7 === 0 ? ["ATTENDANCE_ABSENTEEISM"] : []),
      ...(s.seq % 11 === 0 ? ["ATTENDANCE_TARDINESS"] : []),
      ...(s.seq % 17 === 0 ? ["ATTENDANCE_LOW"] : []),
    ];
    for (const code of rules) {
      const typeId = M.alertTypes.get(code);
      if (typeId == null) continue;
      const key = `${actorId}:${typeId}`;
      if (M.alerts.has(key)) continue;
      alertJobs.push({ actorId, typeId, key });
    }
  }
  const tick = progress(alertJobs.length, 100, "alerts");
  await pooled(alertJobs, CONCURRENCY, async (a, i) => {
    const created = await post("notification", "/api/v1/alerts", { academic_actor_id: a.actorId, alert_type_id: a.typeId });
    M.alerts.add(a.key);
    // 1 de cada 3 se cierra: antes quedaban 493 abiertas y ninguna resuelta, con
    // lo que el tablero no tenia historial y resolved_at era NULL en todas.
    const alertId = created ? pick(created, "AlertID", "alertId", "id") : null;
    if (alertId != null && i % 3 === 0) {
      await call("notification", "PATCH", "/api/v1/alerts/" + alertId + "/resolve", {}, true);
    }
    tick();
  });
  // Alertas levantadas contra los tipos duplicados de corridas anteriores: se
  // borran (soft delete) para que cada estudiante tenga UNA alerta por motivo y
  // no dos, una por cada copia del catalogo.
  const legacyTypeIds = new Set(
    LEGACY_ALERT_TYPE_CODES.map((code) => M.alertTypes.get(code)).filter((v) => v != null)
  );
  const orphans = existingAlerts.filter((a) => legacyTypeIds.has(pick(a, "AlertTypeID", "alert_type_id")));
  if (orphans.length) {
    const tickDel = progress(orphans.length, 100, "duplicate alerts");
    await pooled(orphans, CONCURRENCY, async (a) => {
      await call("notification", "DELETE", "/api/v1/alerts/" + pick(a, "AlertID", "alertId", "id"), undefined, true);
      tickDel();
    });
  }

  // Y se cierra 1 de cada 3 de las que siguen abiertas: el bucle de creacion solo
  // resuelve las nuevas, asi que en una base ya sembrada no se cerraba ninguna.
  const openAlerts = existingAlerts.filter(
    (a) => !legacyTypeIds.has(pick(a, "AlertTypeID", "alert_type_id")) && !pick(a, "ResolvedAt", "resolved_at")
  );
  // Se decide por el id de la alerta, no por su posicion: filtrar sobre el conjunto
  // de abiertas (que encoge en cada corrida) cerraba otro tercio cada vez hasta
  // dejarlas todas resueltas. Con el id, la misma alerta se cierra siempre.
  const toResolve = openAlerts.filter((a) => Number(pick(a, "AlertID", "alertId", "id")) % 3 === 0);
  if (toResolve.length) {
    const tickRes = progress(toResolve.length, 100, "alert resolutions");
    await pooled(toResolve, CONCURRENCY, async (a) => {
      await call("notification", "PATCH", "/api/v1/alerts/" + pick(a, "AlertID", "alertId", "id") + "/resolve", {}, true);
      tickRes();
    });
  }
  // Y por ultimo los tipos duplicados, ya sin ninguna alerta apuntando a ellos:
  // /alert-types devolvia nueve filas para los cinco motivos del catalogo.
  for (const code of LEGACY_ALERT_TYPE_CODES) {
    const id = M.alertTypes.get(code);
    if (id != null) await call("notification", "DELETE", "/api/v1/alert-types/" + id, undefined, true);
  }
  await get("notification", "/api/v1/alerts?limit=5");
  done();
}

// Quality: projects plus read-only instruments used by frontend forms.
async function seedQuality() {
  const done = banner("quality");
  for (const p of asArray(await get("quality", "/api/v1/quality/projects"))) {
    if (p?.name) M.projects.add(p.name);
  }
  for (const name of ["Evaluación institucional 2026-I", "Autoevaluación institucional 2026-II"]) {
    if (M.projects.has(name)) continue;
    await post("quality", "/api/v1/quality/projects", { name, status: "Active" });
    M.projects.add(name);
  }
  await get("quality", "/api/v1/quality/characteristics");
  await get("quality", "/api/v1/quality/process/profile");
  await get("quality", "/api/v1/quality/istqb/categories");
  await get("quality", "/api/v1/quality/projects");
  done();
}

// Endpoints with confirmed, still-unfixed backend defects (see README "known issues").
// They run normally but never fail the seed. Keep this empty: an entry here hides a real
// regression, so only add one with a comment naming the defect and where it is tracked.
const KNOWN_ISSUES = new Set([]);

async function main() {
  console.log(`seed start (${new Date().toISOString()}) - concurrency=${CONCURRENCY}`);
  await loginSeed();
  await seedIdentity();
  await seedAuthorization();
  await seedAcademic();
  await seedScheduling();
  await seedAttendance();
  await seedBiometric();
  await seedConfiguration();
  await seedNotification();
  await seedQuality();
  const failed = results.filter((r) => !r.ok && !KNOWN_ISSUES.has(r.label));
  const known = results.filter((r) => !r.ok && KNOWN_ISSUES.has(r.label));
  console.log(`\nseed done: ${results.length - failed.length - known.length}/${results.length} requests ok${known.length ? `, ${known.length} known backend bugs (see README)` : ""}`);
  if (known.length) {
    console.log("known backend bugs (warn, exit code unaffected):");
    for (const f of known) console.log(`  WARN ${f.status} ${f.label}`);
  }
  if (failed.length) {
    console.log("failures:");
    for (const f of failed) console.log(`  ${f.status} ${f.label}`);
    process.exitCode = 1;
  }
}

await main();
