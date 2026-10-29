// Cada ruta del catálogo del frontend debe existir en el contrato OpenAPI generado del servicio
// dueño (docs/openapi, regenerado y verificado en CI). Una ruta que no está ahí es un enlace roto:
// el gateway la manda a un servicio que responde 404.
// Los servicios Node (academic, configuration, notification, quality) aún no generan contrato
// (docs/openapi/README.md, "Known gap"), así que sus grupos no se verifican aquí.
import fs from "fs";
import path from "path";
import { endpoints } from "../endpoints";

const OPENAPI_DIR = path.resolve(__dirname, "../../../../../docs/openapi");
const CONTRACTED_GROUPS = ["identity", "authorization", "scheduling", "attendance", "biometric"];

function contractPaths() {
    const patterns = [];
    for (const file of fs.readdirSync(OPENAPI_DIR).filter((f) => f.endsWith(".json"))) {
        const spec = JSON.parse(fs.readFileSync(path.join(OPENAPI_DIR, file), "utf8"));
        for (const p of Object.keys(spec.paths ?? {})) {
            patterns.push(new RegExp(`^${p.replace(/\{[^}]+\}/g, "[^/]+").replace(/\/$/, "")}/?$`));
        }
    }
    return patterns;
}

function catalog(group) {
    return Object.entries(endpoints[group]).map(([name, value]) => {
        const built = typeof value === "function" ? value(...Array(value.length).fill("X")) : value;
        return [name, built.split("?")[0]];
    });
}

const patterns = contractPaths();

test("the OpenAPI contracts are readable and the check rejects a path that does not exist", () => {
    expect(patterns.length).toBeGreaterThan(100);
    expect(patterns.some((rx) => rx.test("/api/v1/attendance-records/X/nope"))).toBe(false);
    expect(patterns.some((rx) => rx.test("/api/v1/attendance-records/X"))).toBe(true);
});

describe.each(CONTRACTED_GROUPS)("%s endpoints exist in the generated contract", (group) => {
    test.each(catalog(group))("%s → %s", (_name, built) => {
        expect(patterns.some((rx) => rx.test(built))).toBe(true);
    });
});
