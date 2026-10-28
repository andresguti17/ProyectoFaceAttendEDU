#!/usr/bin/env node
// FaceAttend EDU — integration check: a failed account provisioning leaves no orphan rows.
//
// Through Kong, as an administrator:
//   1. POST /api/v1/users/provision for an apprentice whose cohort does not exist
//      (academic rejects the enrollment after identity already created person + user
//      and academic created the actor).
//   2. The call must fail, and afterwards neither the person (identity) nor the
//      academic actor (academic) may exist.
//   3. A valid provisioning (no actor) succeeds, to prove the endpoint itself works.
//
// Usage: API_URL=http://localhost:8000 ADMIN_IDENTIFIER=... ADMIN_PASSWORD=... SCHOOL_ID=1 \
//        node tools/e2e/user-provisioning-rollback.mjs

import { randomBytes } from "node:crypto";

const API = (process.env.API_URL || "http://localhost:8000").replace(/\/+$/, "");
// Ley 1581: provisioning requires the holder's acceptance of the current privacy notice.
const CONSENT = { policyVersion: process.env.PRIVACY_POLICY_VERSION || "2026-11", biometricAccepted: false };
for (const name of ["ADMIN_IDENTIFIER", "ADMIN_PASSWORD", "SCHOOL_ID"]) {
  if (!process.env[name]) {
    console.error(`${name} is required`);
    process.exit(2);
  }
}

async function call(method, path, token, json) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const items = (data) => (Array.isArray(data) ? data : data?.data ?? data?.items ?? data?.content ?? []);

// Contraseña de las cuentas de prueba: aleatoria por ejecución, nunca un literal en el código.
const TEST_PASSWORD = `Tmp-${randomBytes(9).toString("base64url")}-1!`;
const clean = (value) => String(value).replaceAll("\r", " ").replaceAll("\n", " ");

async function main() {
  const login = await call("POST", "/api/v1/auth/login", null, { identifier: process.env.ADMIN_IDENTIFIER, password: process.env.ADMIN_PASSWORD });
  const token = login.data?.sessionId;
  if (!token) throw new Error(`admin login failed (${login.status})`);

  const stamp = Date.now().toString().slice(-8);
  const document = `E2E${stamp}`;
  const failed = await call("POST", "/api/v1/users/provision", token, {
    person: { documentNumber: document, name: "Rollback", lastName: "Check", email: `rollback.${stamp}@e2e.local` },
    username: `rollback.${stamp}`,
    password: TEST_PASSWORD,
    roleName: "Aprendiz",
    consent: CONSENT,
    academicActor: { actorTypeId: 1, schoolId: Number(process.env.SCHOOL_ID), actorCode: document, cohortId: 999999999 },
  });
  console.log(`invalid provisioning -> ${failed.status} ${clean(JSON.stringify(failed.data).slice(0, 160))}`);
  if (failed.status < 400) throw new Error("the provisioning with an unknown cohort should have failed");

  const persons = items((await call("GET", "/api/v1/persons?limit=500", token)).data);
  const orphanPerson = persons.find((p) => p.documentNumber === document);
  const actors = items((await call("GET", "/api/v1/academic-actors?limit=2000", token)).data);
  const orphanActor = actors.find((a) => a.actorCode === document);
  console.log(`orphan person: ${orphanPerson ? "YES" : "no"}, orphan academic actor: ${orphanActor ? "YES" : "no"}`);
  if (orphanPerson || orphanActor) process.exit(1);

  const ok = await call("POST", "/api/v1/users/provision", token, {
    person: { documentNumber: `${document}B`, name: "Provision", lastName: "Check", email: `provision.${stamp}@e2e.local` },
    username: `provision.${stamp}`,
    password: TEST_PASSWORD,
    roleName: "Administrador",
    consent: CONSENT,
  });
  console.log(`valid provisioning -> ${ok.status}`);
  if (ok.status !== 201) process.exit(1);
  console.log("OK: failed provisioning leaves no orphans and a valid one succeeds");
}

main().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
