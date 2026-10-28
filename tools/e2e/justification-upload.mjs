#!/usr/bin/env node
// FaceAttend EDU — end-to-end check of the justification supporting document flow,
// through Kong exactly as the apps use it (Node >= 20, no dependencies):
//
//   1. The apprentice files a justification for one of their Absent/Late records.
//   2. The apprentice uploads a PDF (multipart) -> attendance stores it in MinIO.
//   3. The reviewer lists the documents and downloads the content.
//   4. The downloaded bytes must have the same SHA-256 as the uploaded ones.
//
// Usage:
//   API_URL=http://localhost:8000 \
//   APPRENTICE_IDENTIFIER=... APPRENTICE_PASSWORD=... \
//   REVIEWER_IDENTIFIER=... REVIEWER_PASSWORD=... \
//   [ATTENDANCE_RECORD_ID=123] node tools/e2e/justification-upload.mjs
//
// Exit code 0 = flow works end to end.

import { createHash } from "node:crypto";

// Sin regex: `/\/+$/` retrocede de forma super-lineal (Sonar S8786).
function trimTrailingSlashes(url) {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end -= 1;
  return url.slice(0, end);
}

const API = trimTrailingSlashes(process.env.API_URL || "http://localhost:8000");

// IDs devueltos por el servidor: se codifican antes de ir en la ruta (S7044/S8476) y
// se les quitan los saltos de línea antes de imprimirlos (S5145).
const seg = (value) => encodeURIComponent(String(value));
const clean = (value) => String(value).replaceAll("\r", " ").replaceAll("\n", " ");
const required = ["APPRENTICE_IDENTIFIER", "APPRENTICE_PASSWORD", "REVIEWER_IDENTIFIER", "REVIEWER_PASSWORD"];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`${name} is required`);
    process.exit(2);
  }
}

async function call(method, path, { token, json, form, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`${API}${path}`, { method, headers, body });
  if (raw) return res;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return data;
}

async function login(identifier, password) {
  const session = await call("POST", "/api/v1/auth/login", { json: { identifier, password } });
  if (!session?.sessionId) throw new Error(`login failed for ${identifier} (2FA or missing session)`);
  return session.sessionId;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Smallest valid PDF with a unique marker, so each run uploads different bytes.
function samplePdf() {
  const marker = `FaceAttend e2e ${new Date().toISOString()}`;
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n` +
      `% ${marker}\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
    "latin1",
  );
}

async function pickRecord(token) {
  if (process.env.ATTENDANCE_RECORD_ID) return Number(process.env.ATTENDANCE_RECORD_ID);
  const records = await call("GET", "/api/v1/attendance-records?limit=200", { token });
  const list = Array.isArray(records) ? records : records?.data ?? records?.items ?? [];
  const justifications = await call("GET", "/api/v1/justifications?limit=500", { token });
  const taken = new Set((Array.isArray(justifications) ? justifications : []).map((j) => j.attendanceRecordId));
  const record = list.find((r) => ["Absent", "Late"].includes(r.attendanceStatus) && !taken.has(r.attendanceRecordId));
  if (!record) throw new Error("the apprentice has no Absent/Late record without a justification (set ATTENDANCE_RECORD_ID)");
  return record.attendanceRecordId;
}

async function main() {
  const apprentice = await login(process.env.APPRENTICE_IDENTIFIER, process.env.APPRENTICE_PASSWORD);
  const reviewer = await login(process.env.REVIEWER_IDENTIFIER, process.env.REVIEWER_PASSWORD);

  const recordId = await pickRecord(apprentice);
  const types = await call("GET", "/api/v1/justification-types", { token: apprentice });
  const justification = await call("POST", "/api/v1/justifications", {
    token: apprentice,
    json: { attendanceRecordId: recordId, justificationTypeId: types[0]?.justificationTypeId, reason: "e2e supporting document check" },
  });
  console.log(`justification ${clean(justification.justificationId)} for record ${clean(recordId)}`);

  const pdf = samplePdf();
  const form = new FormData();
  form.append("file", new Blob([pdf], { type: "application/pdf" }), "soporte-e2e.pdf");
  const doc = await call("POST", `/api/v1/justifications/${seg(justification.justificationId)}/documents`, { token: apprentice, form });
  console.log(`uploaded document ${clean(doc.supportingDocumentId)} -> ${clean(doc.storageUri)} (${clean(doc.sizeBytes)} bytes)`);

  const listed = await call("GET", `/api/v1/justifications/${seg(justification.justificationId)}/documents`, { token: reviewer });
  if (!listed.some((d) => d.supportingDocumentId === doc.supportingDocumentId)) throw new Error("the reviewer does not see the document");

  const res = await call("GET", `/api/v1/supporting-documents/${seg(doc.supportingDocumentId)}/content`, { token: reviewer, raw: true });
  if (!res.ok) throw new Error(`content download -> ${res.status}`);
  const downloaded = Buffer.from(await res.arrayBuffer());
  const same = sha256(downloaded) === sha256(pdf);
  console.log(`reviewer downloaded ${downloaded.length} bytes, content-type ${res.headers.get("content-type")}, sha256 ${same ? "matches" : "DIFFERS"}`);
  if (!same) process.exit(1);

  const foreign = await call("GET", `/api/v1/supporting-documents/${seg(doc.supportingDocumentId)}/content`, { raw: true });
  if (foreign.status !== 401) throw new Error(`content without a session should be 401, got ${foreign.status}`);
  console.log("OK: the document is stored in MinIO and the reviewer opens the same bytes");
}

main().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
