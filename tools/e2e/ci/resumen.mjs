#!/usr/bin/env node
// Convierte e2e-resultados.json en una tabla Markdown (resumen del job de GitHub Actions).
//
//   node tools/e2e/ci/resumen.mjs [e2e-resultados.json] >> "$GITHUB_STEP_SUMMARY"

import { existsSync, readFileSync } from "node:fs";

const file = process.argv[2] || "e2e-resultados.json";
if (!existsSync(file)) {
  console.log(`## Flujos E2E del MVP\n\nNo hay \`${file}\`: los flujos no llegaron a correr (mira los pasos anteriores).`);
  process.exit(0);
}

const r = JSON.parse(readFileSync(file, "utf8"));
const icon = { "pasó": "✅", "falló": "❌", "omitido": "⏭️" };
const cell = (s) => String(s ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const lines = [
  "## Flujos E2E del MVP",
  "",
  `${r.pasaron} pasaron, ${r.fallaron} fallaron, ${r.omitidos} omitidos en ${Math.round(r.duracionMs / 1000)} s (corrida \`${r.corrida}\`).`,
  "",
  "| # | Flujo | Estado | Pasos comprobados | Tiempo | Error |",
  "|---|---|---|---|---|---|",
  ...r.flujos.map((f) => `| ${f.n} | ${cell(f.nombre)} | ${icon[f.estado] ?? ""} ${f.estado} | ${f.pasos.length} | ${(f.ms / 1000).toFixed(1)} s | ${cell(f.error)} |`),
  "",
  `Limpieza: ${cell(r.limpieza)}`,
];
console.log(lines.join("\n"));
