#!/usr/bin/env node
// FaceAttend EDU — los 6 flujos críticos del MVP de punta a punta contra Kong (Node >= 20,
// sin dependencias). Cada corrida crea su propia sede de prueba (prefijo E2E) y al final
// la desactiva con borrado lógico.
//
//   1 login       login y cambio de contraseña
//   2 alta        alta de sede, programa, ficha y aprendices
//   3 horario     horario y sesión de clase
//   4 asistencia  asistencia manual y cierre con ausentes
//   5 justif      justificación con revisión
//   6 web         sesión web en cookie y cierre de sesión
//
// Uso:
//   API_URL=http://localhost:8000 WEB_ORIGIN=http://localhost:8090 \
//   E2E_ADMIN_USERNAME=... E2E_ADMIN_PASSWORD=... node tools/e2e/mvp-flujos.mjs
//
// Opcionales: E2E_RESULTADOS (ruta del JSON, por defecto e2e-resultados.json),
// E2E_FLUJOS=1,4 (solo esos y los que necesitan), E2E_LIMPIAR=0 (deja los datos),
// E2E_ALLOW_ADMIN_PASSWORD_CHANGE=1 (solo en un entorno desechable: si la cuenta del
// Super Administrador aún tiene la clave inicial, la cambia por una que nadie conoce).
//
// Salida: 0 si todos los flujos pasan, 1 si alguno falla, 2 si falta configuración.
// Un flujo cuyo requisito falló queda "omitido" (no cuenta como pasado).

import { writeFileSync } from "node:fs";
import { API, runId } from "./mvp/http.mjs";
import {
  flujoAltaSede, flujoAsistencia, flujoHorario, flujoJustificacion, flujoLogin, flujoSesionWeb, limpiar,
} from "./mvp/flujos.mjs";

const FLUJOS = [
  { n: 1, id: "login", nombre: "Login y cambio de contraseña", run: flujoLogin, requiere: [] },
  { n: 2, id: "alta", nombre: "Alta de sede, programa, ficha y aprendices", run: flujoAltaSede, requiere: [1] },
  { n: 3, id: "horario", nombre: "Horario y sesión de clase", run: flujoHorario, requiere: [2] },
  { n: 4, id: "asistencia", nombre: "Asistencia manual y cierre con ausentes", run: flujoAsistencia, requiere: [3] },
  { n: 5, id: "justificacion", nombre: "Justificación con revisión", run: flujoJustificacion, requiere: [4] },
  { n: 6, id: "sesion-web", nombre: "Sesión web en cookie y cierre de sesión", run: flujoSesionWeb, requiere: [2] },
];

for (const name of ["E2E_ADMIN_USERNAME", "E2E_ADMIN_PASSWORD"]) {
  if (!process.env[name]) {
    console.error(`${name} es obligatoria (cuenta de Super Administrador del entorno de prueba)`);
    process.exit(2);
  }
}

// E2E_FLUJOS=5 corre también 1-4, de los que depende.
function seleccion() {
  const pedidos = (process.env.E2E_FLUJOS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
  if (!pedidos.length) return new Set(FLUJOS.map((f) => f.n));
  const set = new Set();
  const add = (n) => {
    if (set.has(n)) return;
    set.add(n);
    FLUJOS.find((f) => f.n === n)?.requiere.forEach(add);
  };
  pedidos.forEach(add);
  return set;
}

const clean = (v) => String(v).replaceAll("\r", " ").replaceAll("\n", " ");

async function main() {
  const out = process.env.E2E_RESULTADOS || "e2e-resultados.json";
  const ctx = { rid: runId(), cleanup: { users: [] } };
  const elegidos = seleccion();
  const resultados = [];
  const inicio = Date.now();
  console.log(`▶ Flujos E2E del MVP contra ${API} (corrida ${ctx.rid})`);

  for (const f of FLUJOS.filter((x) => elegidos.has(x.n))) {
    const r = { n: f.n, id: f.id, nombre: f.nombre, estado: "pasó", pasos: [], ms: 0 };
    const faltan = f.requiere.filter((n) => resultados.find((x) => x.n === n)?.estado !== "pasó");
    if (faltan.length) {
      r.estado = "omitido";
      r.error = `requiere el flujo ${faltan.join(", ")}`;
      resultados.push(r);
      console.log(`\n– ${f.n}. ${f.nombre}: omitido (${r.error})`);
      continue;
    }
    console.log(`\n■ ${f.n}. ${f.nombre}`);
    const t0 = Date.now();
    try {
      await f.run(ctx, (paso) => {
        r.pasos.push(paso);
        console.log(`  ✔ ${clean(paso)}`);
      });
    } catch (e) {
      r.estado = "falló";
      r.error = clean(e.message);
      console.log(`  ✘ ${r.error}`);
    }
    r.ms = Date.now() - t0;
    resultados.push(r);
  }

  let limpieza = "omitida (E2E_LIMPIAR=0)";
  if (process.env.E2E_LIMPIAR !== "0") {
    const notas = await limpiar(ctx).catch((e) => [clean(e.message)]);
    limpieza = notas.length ? `incompleta: ${notas.join("; ")}` : "datos de la corrida desactivados (borrado lógico)";
  }

  const resumen = {
    api: API,
    corrida: ctx.rid,
    fecha: new Date().toISOString(),
    duracionMs: Date.now() - inicio,
    pasaron: resultados.filter((r) => r.estado === "pasó").length,
    fallaron: resultados.filter((r) => r.estado === "falló").length,
    omitidos: resultados.filter((r) => r.estado === "omitido").length,
    limpieza,
    flujos: resultados,
  };
  writeFileSync(out, JSON.stringify(resumen, null, 2) + "\n", "utf8");
  console.log(`\n${resumen.pasaron} pasaron, ${resumen.fallaron} fallaron, ${resumen.omitidos} omitidos en ${Math.round(resumen.duracionMs / 1000)} s. Limpieza: ${limpieza}.`);
  console.log(`Resultado: ${out}`);
  // exitCode y no exit(): en Windows, salir con sockets de fetch aún cerrándose aborta Node.
  process.exitCode = resumen.fallaron || resumen.omitidos ? 1 : 0;
}

main().catch((e) => {
  console.error(`FALLÓ: ${clean(e.message)}`);
  process.exitCode = 1;
});
