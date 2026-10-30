// Los 6 flujos críticos del MVP (informe de especificación). Cada uno recibe el contexto
// compartido `ctx` y anota en `step()` lo que comprobó; lanza un Error si algo falla.
// Los flujos 3 a 5 usan los datos que deja el 2 (la sede de prueba de esta corrida).

import {
  WEB_ORIGIN, call, check, docNumber, expectStatus, items, login, must, pick, secret, seg, session, today, waitFor,
} from "./http.mjs";

const PRIVACY_VERSION = process.env.E2E_PRIVACY_VERSION || "2026-11";
const TERMS_VERSION = process.env.E2E_TERMS_VERSION || "2026-10";
const email = (ctx, who) => `e2e.${who}.${ctx.rid}@example.test`;

// ── 1. Login y cambio de contraseña ─────────────────────────────────────────

export async function flujoLogin(ctx, step) {
  const { E2E_ADMIN_USERNAME: user, E2E_ADMIN_PASSWORD: password } = process.env;
  let admin = await session(user, password);
  step("login del Super Administrador");
  // La cuenta de bootstrap-admin.sh nace con clave inicial (mustChangePassword).
  check("la cuenta del Super Administrador debe venir con su clave inicial", admin.mustChangePassword,
    "créala o reiníciala con tools/e2e/ci/cuentas.sh antes de cada corrida");
  check("el entorno permite cambiarla", process.env.E2E_ALLOW_ADMIN_PASSWORD_CHANGE === "1",
    "define E2E_ALLOW_ADMIN_PASSWORD_CHANGE=1 solo en un entorno desechable");
  const personId = (await must("datos del Super Administrador", "GET", `/users/${seg(admin.userId)}`, { token: admin.token })).personId;
  const blocked = await call("POST", `/persons/${seg(personId)}/terms`, { token: admin.token, json: { termsVersion: TERMS_VERSION } });
  expectStatus("escritura antes de cambiar la clave inicial", blocked, 403);
  check("el gateway explica el bloqueo", blocked.json?.code === "PASSWORD_CHANGE_REQUIRED", blocked.text.slice(0, 120));
  step("con la clave inicial el gateway bloquea las escrituras (403 PASSWORD_CHANGE_REQUIRED)");

  // La clave nueva solo vive en memoria: la cuenta no vuelve a usarse fuera de esta corrida.
  const next = secret();
  await must("cambio de la clave inicial", "POST", "/auth/change-password",
    { token: admin.token, json: { currentPassword: password, newPassword: next } }, [200, 204]);
  expectStatus("login con la clave inicial tras el cambio", await login(user, password), 401);
  admin = await session(user, next);
  check("tras el cambio ya no pide cambiar la clave", !admin.mustChangePassword);
  await must("aceptación de términos tras el cambio", "POST", `/persons/${seg(personId)}/terms`,
    { token: admin.token, json: { termsVersion: TERMS_VERSION } }, [200, 201, 204]);
  step("cambio de la clave inicial: la anterior da 401, la nueva entra y ya puede escribir");
  ctx.superToken = admin.token;
  ctx.superUserId = admin.userId;

  // Cambio voluntario en una cuenta creada por el Super Administrador (sin sede).
  const username = `e2e.clave.${ctx.rid}`;
  const initial = secret();
  const created = await must("alta de la cuenta de prueba", "POST", "/users/provision", {
    token: ctx.superToken,
    json: {
      username, password: initial, roleName: "Administrador", sendCredentials: false,
      person: { documentType: "CC", documentNumber: docNumber(), name: "Prueba", lastName: "Cambio Clave", email: email(ctx, "clave"), status: true },
      consent: { policyVersion: PRIVACY_VERSION, biometricAccepted: false },
    },
  });
  ctx.cleanup.users.push(pick(created, "userId") ?? pick(created?.user, "userId", "id"));
  expectStatus("login con contraseña equivocada", await login(username, `${initial}x`), 401);
  const first = await session(username, initial);
  const weak = await call("POST", "/auth/change-password", { token: first.token, json: { currentPassword: initial, newPassword: "corta" } });
  check("una clave que no cumple la política se rechaza", weak.status >= 400 && weak.status < 500, `HTTP ${weak.status}`);
  const changed = secret();
  await must("cambio voluntario de clave", "POST", "/auth/change-password", { token: first.token, json: { currentPassword: initial, newPassword: changed } }, [200, 204]);
  expectStatus("login con la clave anterior", await login(username, initial), 401);
  await session(username, changed);
  step("cuenta nueva: clave equivocada 401, política aplicada, el cambio invalida la anterior");
}

// ── 2. Alta de sede, programa, ficha y aprendices ───────────────────────────

async function provision(ctx, who, roleName, actorCode, person, cohortId) {
  const password = secret();
  const username = `e2e.${who}.${ctx.rid}`;
  const academicActor = { actorCode, actorTypeId: ctx.actorTypes[roleName === "Instructor" ? "INSTRUCTOR" : "STUDENT"], schoolId: ctx.schoolId };
  if (cohortId) academicActor.cohortId = cohortId;
  const r = await must(`alta de ${who} (${roleName})`, "POST", "/users/provision", {
    token: ctx.superToken,
    json: {
      username, password, roleName, sendCredentials: false,
      person: { documentType: "CC", documentNumber: docNumber(), ...person, email: email(ctx, who), status: true },
      consent: { policyVersion: PRIVACY_VERSION, biometricAccepted: false },
      academicActor,
    },
  });
  const account = {
    username, password,
    userId: pick(r, "userId") ?? pick(r?.user, "userId", "id"),
    personId: pick(r, "personId") ?? pick(r?.person, "personId", "id"),
    actorId: pick(r, "academicActorId") ?? pick(r?.academicActor, "academicActorId", "id"),
  };
  ctx.cleanup.users.push(account.userId);

  // Primer ingreso: cambia la clave inicial y acepta los términos, como en la app.
  let s = await session(username, password);
  if (s.mustChangePassword) {
    account.password = secret();
    await must(`cambio de clave de ${who}`, "POST", "/auth/change-password", { token: s.token, json: { currentPassword: password, newPassword: account.password } }, [200, 204]);
    s = await session(username, account.password);
  }
  account.userId ??= s.userId;
  account.personId ??= (await must(`datos de ${who}`, "GET", `/users/${seg(s.userId)}`, { token: s.token })).personId;
  const terms = await call("GET", `/persons/${seg(account.personId)}/terms`, { token: s.token });
  if (!terms.json?.acceptedVersion) {
    await must(`términos de ${who}`, "POST", `/persons/${seg(account.personId)}/terms`, { token: s.token, json: { termsVersion: TERMS_VERSION } }, [200, 201, 204]);
  }
  account.token = s.token;
  return account;
}

export async function flujoAltaSede(ctx, step) {
  const code = `E2E${ctx.rid.toUpperCase()}`;
  const adminPassword = secret();
  const onboard = await must("alta pública de sede", "POST", "/onboarding/schools", {
    json: {
      school: { code, name: `E2E Centro de Pruebas ${ctx.rid}`, address: "Calle 50 # 45-10", cityName: "Medellín", email: email(ctx, "sede"), phone: "6044440000" },
      admin: {
        documentType: "CC", documentNumber: docNumber(), name: "Gloria", lastName: "Ramírez Prueba",
        email: email(ctx, "admin"), phone: "3001112233", username: `e2e.admin.${ctx.rid}`, password: adminPassword,
        privacyPolicyVersion: PRIVACY_VERSION, biometricAccepted: false,
      },
    },
  }, [200, 201, 202]);
  ctx.cleanup.users.push(onboard.userId);
  step("alta pública de la sede y su administrador (queda pendiente de activación)");

  const pending = await login(`e2e.admin.${ctx.rid}`, adminPassword);
  check("un administrador sin activar no entra", pending.status !== 200, `HTTP ${pending.status}`);
  await must("activación del administrador", "POST", `/users/${seg(onboard.userId)}/activate`, { token: ctx.superToken }, [200, 204]);
  let schoolId = pick(onboard, "schoolId") ?? pick(onboard?.school, "schoolId", "id");
  if (!schoolId) {
    schoolId = items((await call("GET", "/schools?limit=200", { token: ctx.superToken })).json).find((s) => s.code === code)?.schoolId;
  }
  check("id de la sede nueva", Boolean(schoolId));
  const school = await must("consulta de la sede", "GET", `/schools/${seg(schoolId)}`, { token: ctx.superToken });
  if (school?.status === false) {
    await must("activación de la sede", "PATCH", `/schools/${seg(schoolId)}/status`, { token: ctx.superToken, json: { status: true } }, [200, 204]);
  }
  ctx.schoolId = schoolId;
  ctx.cleanup.schoolId = schoolId;
  step("el Super Administrador activa la sede y su administrador");

  const admin = await session(`e2e.admin.${ctx.rid}`, adminPassword);
  ctx.adminToken = admin.token;
  ctx.adminUserId = admin.userId;
  const adminPerson = (await must("datos del administrador", "GET", `/users/${seg(admin.userId)}`, { token: admin.token })).personId;
  const terms = await call("GET", `/persons/${seg(adminPerson)}/terms`, { token: admin.token });
  if (!terms.json?.acceptedVersion) {
    await must("términos del administrador", "POST", `/persons/${seg(adminPerson)}/terms`, { token: admin.token, json: { termsVersion: TERMS_VERSION } }, [200, 201, 204]);
  }
  step("el administrador de la sede inicia sesión");

  const types = items(await must("tipos de actor", "GET", "/actor-types", { token: admin.token }));
  ctx.actorTypes = Object.fromEntries(types.map((t) => [t.code, t.actorTypeId]));
  check("tipos de actor STUDENT e INSTRUCTOR", ctx.actorTypes.STUDENT && ctx.actorTypes.INSTRUCTOR, JSON.stringify(ctx.actorTypes));

  const t = admin.token;
  const { date } = today();
  const year = Number(date.slice(0, 4));
  const program = await must("programa", "POST", "/programs", { token: t, json: { schoolId, code: `E2EADSO${ctx.rid}`, name: "Tecnología en Análisis y Desarrollo de Software" } });
  const period = await must("periodo", "POST", "/academic-periods", { token: t, json: { schoolId, name: `E2E ${year} ${ctx.rid}`, startsOn: `${year}-01-01`, endsOn: `${year}-12-31`, isActive: true } });
  const cohort = await must("ficha", "POST", "/cohorts", { token: t, json: { programId: program.programId, academicPeriodId: pick(period, "academicPeriodId", "id"), code: `E2E2691${ctx.rid}` } });
  const course = await must("curso", "POST", "/courses", { token: t, json: { programId: program.programId, code: `E2EBD${ctx.rid}`, name: "Bases de Datos Relacionales", creditHours: 4 } });
  const env = await must("ambiente", "POST", "/environments", { token: t, json: { schoolId, code: `E2EAMB${ctx.rid}`, name: "Ambiente 301 — Sistemas", capacity: 30 } });
  Object.assign(ctx, { cohortId: cohort.cohortId, courseId: course.courseId, environmentId: pick(env, "environmentId", "id") });
  step("el administrador crea programa, periodo, ficha, curso y ambiente");

  ctx.instructor = await provision(ctx, "docente", "Instructor", `E2EDOC${ctx.rid}`, { name: "Carlos", lastName: "Restrepo Prueba" });
  ctx.presente = await provision(ctx, "aprendiz1", "Aprendiz", `E2EA1${ctx.rid}`, { name: "Valentina", lastName: "Ríos Prueba", birthDate: "2001-05-14" });
  ctx.ausente = await provision(ctx, "aprendiz2", "Aprendiz", `E2EA2${ctx.rid}`, { name: "Andrés", lastName: "Gómez Prueba", birthDate: "2002-03-09" });
  step("alta de un instructor y dos aprendices: cada uno inicia sesión y acepta los términos");

  for (const who of [ctx.instructor, ctx.presente, ctx.ausente]) {
    if (who.actorId) continue;
    const actors = items((await call("GET", `/academic-actors?schoolId=${seg(schoolId)}&limit=100`, { token: t })).json);
    who.actorId = actors.find((a) => a.personId === who.personId)?.academicActorId;
    check(`actor académico de ${who.username}`, Boolean(who.actorId));
  }
  for (const who of [ctx.presente, ctx.ausente]) {
    const r = await call("POST", "/enrollments", { token: t, json: { academicActorId: who.actorId, cohortId: ctx.cohortId, enrolledOn: `${year}-01-01`, enrollmentStatus: "Active" } });
    expectStatus(`matrícula de ${who.username}`, r, [200, 201, 409]);
  }
  const roster = items((await call("GET", `/enrollments?cohortId=${seg(ctx.cohortId)}&limit=100`, { token: t })).json)
    .filter((e) => (e.enrollmentStatus ?? "Active") === "Active").map((e) => String(e.academicActorId));
  check("la ficha tiene a los dos aprendices", [ctx.presente, ctx.ausente].every((w) => roster.includes(String(w.actorId))), `matrículas: ${roster.join(",")}`);
  step("los dos aprendices quedan matriculados en la ficha");
}

// ── 3. Horario y sesión de clase ────────────────────────────────────────────

export async function flujoHorario(ctx, step) {
  const { date, dayOfWeek } = today();
  const t = ctx.adminToken;
  const block = await must("bloque horario", "POST", "/schedule-blocks", {
    token: t,
    json: { cohortId: ctx.cohortId, courseId: ctx.courseId, environmentId: ctx.environmentId, instructorActorId: ctx.instructor.actorId, dayOfWeek, startsAt: "06:00:00", endsAt: "08:00:00" },
  });
  ctx.blockId = pick(block, "scheduleBlockId", "id");
  step(`bloque horario de la ficha (día ISO ${dayOfWeek}, 06:00-08:00)`);

  const clash = await call("POST", "/schedule-blocks", {
    token: t,
    json: { cohortId: ctx.cohortId, courseId: ctx.courseId, environmentId: ctx.environmentId, instructorActorId: ctx.instructor.actorId, dayOfWeek, startsAt: "06:00:00", endsAt: "07:00:00" },
  });
  check("un bloque en la misma sala y hora se rechaza", clash.status >= 400 && clash.status < 500, `HTTP ${clash.status}`);
  step("un segundo bloque en la misma sala y hora se rechaza");

  const blocks = items((await call("GET", `/cohorts/${seg(ctx.cohortId)}/blocks`, { token: ctx.instructor.token })).json);
  check("el instructor ve el bloque de su ficha", blocks.some((b) => String(pick(b, "scheduleBlockId", "id")) === String(ctx.blockId)));

  const created = await must("sesión de clase de hoy", "POST", "/class-sessions", { token: t, json: { scheduleBlockId: ctx.blockId, sessionDate: date } });
  ctx.sessionId = pick(created, "classSessionId", "sessionId", "id");
  const dupSession = await call("POST", "/class-sessions", { token: t, json: { scheduleBlockId: ctx.blockId, sessionDate: date } });
  check("una segunda sesión del mismo bloque y fecha se rechaza", dupSession.status >= 400 && dupSession.status < 500, `HTTP ${dupSession.status}`);
  // Una sesión nace abierta (Open); el instructor la ve en su lista del bloque.
  const listed = items((await call("GET", `/class-sessions?scheduleBlockId=${seg(ctx.blockId)}`, { token: ctx.instructor.token })).json)
    .find((s) => String(pick(s, "classSessionId", "sessionId", "id")) === String(ctx.sessionId));
  check("el instructor ve la sesión abierta", listed?.sessionStatus === "Open", `estado ${listed?.sessionStatus}`);
  step(`sesión de clase del ${date} creada (nace Open, única por bloque y fecha) y visible para el instructor`);
}

// ── 4. Asistencia manual y cierre con ausentes ──────────────────────────────

const recordsOf = async (ctx, token) => items((await call("GET", `/class-sessions/${seg(ctx.sessionId)}/attendance`, { token })).json);
const recordFor = (records, who) => records.find((r) => String(r.academicActorId) === String(who.actorId));

export async function flujoAsistencia(ctx, step) {
  const t = ctx.instructor.token;
  await must("asistencia manual del aprendiz presente", "POST", "/attendance-records", {
    token: t,
    json: { classSessionId: ctx.sessionId, academicActorId: ctx.presente.actorId, attendanceStatus: "Present", captureMethod: "MANUAL" },
  });
  const dup = await call("POST", "/attendance-records", {
    token: t,
    json: { classSessionId: ctx.sessionId, academicActorId: ctx.presente.actorId, attendanceStatus: "Late", captureMethod: "MANUAL" },
  });
  check("un segundo registro del mismo aprendiz y sesión se rechaza", dup.status >= 400 && dup.status < 500, `HTTP ${dup.status}`);
  step("el instructor marca Present (MANUAL); un duplicado se rechaza");

  await must("cierre de la sesión", "POST", `/class-sessions/${seg(ctx.sessionId)}/close`, { token: t, json: { closedBy: ctx.instructor.actorId } }, [200, 204]);
  const closed = await must("consulta de la sesión cerrada", "GET", `/class-sessions/${seg(ctx.sessionId)}`, { token: ctx.adminToken });
  check("la sesión queda cerrada con quién y cuándo", closed.sessionStatus === "Closed" && closed.closedAt && closed.closedBy != null, JSON.stringify(closed).slice(0, 200));
  step("el instructor cierra la sesión (closedBy y closedAt quedan registrados)");

  // ms-notification consume `scheduling.class-session.closed` y marca Absent a quien no tiene registro.
  const absent = await waitFor("el aprendiz sin registro queda Absent al cerrar", async () => {
    const r = recordFor(await recordsOf(ctx, ctx.adminToken), ctx.ausente);
    return r?.attendanceStatus === "Absent" ? r : null;
  });
  ctx.absentRecordId = pick(absent, "attendanceRecordId", "id");
  const present = recordFor(await recordsOf(ctx, ctx.adminToken), ctx.presente);
  check("el presente sigue Present", present?.attendanceStatus === "Present", present?.attendanceStatus);
  step("al cerrar, el aprendiz sin registro queda Absent y el presente no cambia");

  const mine = items((await call("GET", "/attendance-records?limit=50", { token: ctx.ausente.token })).json);
  check("el aprendiz ve su ausencia", mine.some((r) => String(pick(r, "attendanceRecordId", "id")) === String(ctx.absentRecordId)));
  step("el aprendiz ausente ve su registro");
}

// ── 5. Justificación con revisión ───────────────────────────────────────────

export async function flujoJustificacion(ctx, step) {
  const a = ctx.ausente.token;
  const types = items(await must("tipos de justificación", "GET", "/justification-types", { token: a }));
  const type = types.find((x) => x.requiresAttachment) ?? types[0];
  check("hay tipos de justificación", Boolean(type));
  const j = await must("radicación de la justificación", "POST", "/justifications", {
    token: a,
    json: { attendanceRecordId: ctx.absentRecordId, justificationTypeId: type.justificationTypeId, reason: "Cita médica programada (prueba E2E)" },
  });
  const jid = pick(j, "justificationId", "id");
  check("la justificación nace Pending", (j.reviewStatus ?? "Pending") === "Pending", j.reviewStatus);
  step(`el aprendiz radica la justificación (tipo "${type.name}")`);

  const again = await call("POST", "/justifications", {
    token: a, json: { attendanceRecordId: ctx.absentRecordId, justificationTypeId: type.justificationTypeId, reason: "duplicada" },
  });
  check("una segunda justificación del mismo registro se rechaza", again.status >= 400 && again.status < 500, `HTTP ${again.status}`);

  if (type.requiresAttachment) {
    const early = await call("PATCH", `/justifications/${seg(jid)}/review`, {
      token: ctx.adminToken, json: { reviewStatus: "Approved", reviewedBy: ctx.adminUserId, resolutionNotes: "sin soporte" },
    });
    check("aprobar sin soporte cuando el tipo lo exige se rechaza", early.status >= 400 && early.status < 500, `HTTP ${early.status}`);
    const form = new FormData();
    form.append("file", new Blob([`%PDF-1.4\n% e2e ${ctx.rid}\ntrailer<<>>\n%%EOF\n`], { type: "application/pdf" }), "soporte-e2e.pdf");
    await must("subida del soporte", "POST", `/justifications/${seg(jid)}/documents`, { token: a, form });
    step("aprobar sin soporte se rechaza; el aprendiz sube el PDF");
  }

  const reviewed = await must("aprobación", "PATCH", `/justifications/${seg(jid)}/review`, {
    token: ctx.adminToken, json: { reviewStatus: "Approved", reviewedBy: ctx.adminUserId, resolutionNotes: "Soporte verificado (prueba E2E)" },
  });
  const final = reviewed?.reviewStatus ? reviewed : await must("consulta de la justificación", "GET", `/justifications/${seg(jid)}`, { token: ctx.adminToken });
  check("queda Approved con revisor y fecha", final.reviewStatus === "Approved" && final.reviewedBy && final.reviewedAt, JSON.stringify(final).slice(0, 200));
  step("el administrador la aprueba (reviewedBy y reviewedAt quedan registrados)");

  const seen = await call("GET", `/attendance/${seg(ctx.absentRecordId)}/justification`, { token: a });
  expectStatus("el aprendiz consulta su justificación", seen, 200);
  check("el aprendiz la ve aprobada", seen.json?.reviewStatus === "Approved", seen.json?.reviewStatus);
  step("el aprendiz ve su justificación aprobada");
}

// ── 6. Sesión web en cookie y cierre de sesión ──────────────────────────────

const WEB = { "X-Session-Mode": "cookie", "X-Requested-With": "FaceAttend", Origin: WEB_ORIGIN };

function cookieFrom(res) {
  const all = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  const line = all.find((c) => c.toLowerCase().startsWith("fae_session="));
  return line ? { value: line.slice("fae_session=".length).split(";")[0], line } : null;
}

export async function flujoSesionWeb(ctx, step) {
  const page = await fetch(`${WEB_ORIGIN}/login`, { signal: AbortSignal.timeout(15_000) }).catch((e) => ({ status: e.message }));
  check("la web sirve /login", page.status === 200, `HTTP ${page.status}`);
  step("el frontend web sirve /login");

  const who = ctx.instructor;
  const res = await login(who.username, who.password, WEB);
  expectStatus("login web", res, 200);
  const cookie = cookieFrom(res);
  check("el login web deja la cookie fae_session", Boolean(cookie?.value));
  check("la cookie es HttpOnly", /httponly/i.test(cookie.line));
  check("el cuerpo no trae el id de sesión", res.json?.sessionId == null);
  step("login web: cookie HttpOnly y sin id de sesión en el cuerpo");

  const jar = { Cookie: `fae_session=${cookie.value}` };
  expectStatus("sesión con la cookie", await call("GET", "/auth/session", { headers: jar }), 200);
  expectStatus("lectura en otro servicio con la cookie", await call("GET", "/schools?limit=1", { headers: jar }), 200);
  const csrf = await call("POST", "/auth/logout", { headers: { ...jar, Origin: WEB_ORIGIN } });
  expectStatus("escritura con cookie sin X-Requested-With", csrf, 403);
  step("la cookie sirve en identity y en los demás servicios; sin cabecera anti-CSRF la escritura da 403");

  const out = await call("POST", "/auth/logout", { headers: { ...jar, ...WEB } });
  expectStatus("logout web", out, [200, 204]);
  check("el logout borra la cookie", /max-age=0/i.test(cookieFrom(out)?.line ?? ""));
  expectStatus("la cookie tras el logout (identity)", await call("GET", "/auth/session", { headers: jar }), 401);
  expectStatus("la cookie tras el logout (otro servicio)", await call("GET", "/schools?limit=1", { headers: jar }), 401);
  step("logout: borra la cookie y la sesión deja de servir al instante en todo el gateway");
}

// ── Limpieza (borrado lógico, best effort) ──────────────────────────────────

export async function limpiar(ctx) {
  if (!ctx.superToken) return [];
  const notes = [];
  for (const id of ctx.cleanup.users.filter(Boolean)) {
    const r = await call("PATCH", `/users/${seg(id)}/status?status=false`, { token: ctx.superToken });
    if (r.status >= 300) notes.push(`usuario ${id}: HTTP ${r.status}`);
  }
  if (ctx.cleanup.schoolId) {
    const r = await call("PATCH", `/schools/${seg(ctx.cleanup.schoolId)}/status`, { token: ctx.superToken, json: { status: false } });
    if (r.status >= 300) notes.push(`sede ${ctx.cleanup.schoolId}: HTTP ${r.status}`);
  }
  return notes;
}
