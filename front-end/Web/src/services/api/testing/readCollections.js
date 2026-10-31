/* global describe, test, expect, beforeAll */
/**
 * Comparación de listas que pinta la web contra PostgreSQL (pruebas de contrato, lecturas).
 *
 * Para cada colección se baja la lista completa como lo hace la web y se compara:
 *   web ⇄ endpoint   la lista que arma la web no repite ids
 *   endpoint ⇄ BD    mismo conjunto de ids que las filas vivas y mismos valores de las columnas
 * Además, según la colección:
 *   enc        columnas que la BD guarda cifradas (enc:v1:…) mientras la API las devuelve en claro
 *   forbidden  claves que la API nunca debe devolver (hashes, secretos)
 * Con el Super Administrador se espera toda la tabla; con el Admin de sede, solo las filas de su
 * sede (si el endpoint trae filas de otra sede, el escenario falla: es una fuga entre sedes).
 */
import { loginAs, one, pick, scenario, sql } from "./contractHarness";

export const norm = (v) =>
    v === null || v === undefined || v === "" ? null : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 10) : v;

/**
 * Baja la lista como lo hace la web: paginada, de una vez, o dentro de un objeto. Con `sample`, una sola
 * página de esa cantidad de filas (tablas enormes que la web nunca baja completas: fetchAllPages se detiene a las 5000).
 */
export async function fetchList(c, { sample = false } = {}) {
    const { fetchAllPages, request } = require("../../../api/apiClient");
    const { endpoints } = require("../../../api/endpoints");
    const path = c.path(endpoints);
    if (sample && c.sample) return request(path, { method: "GET", query: { limit: c.sample, offset: 0 } });
    if (c.paging === "none") {
        const payload = await request(path, { method: "GET" });
        return c.listKey ? payload?.[c.listKey] ?? [] : payload;
    }
    return fetchAllPages(path, {}, { by: c.paging === "page" ? "page" : "offset" });
}

export function compare(c, items, where, { partial = false } = {}) {
    const textCols = c.text ?? [];
    const enc = c.enc ?? {};
    const cols = [...new Set([...Object.values(c.fields), ...Object.values(enc)])];
    const select = cols.map((col) => (textCols.includes(col) ? `${col}::text as ${col}` : col)).join(", ");
    const db = sql(`select ${c.col}, ${select} from ${c.table} where deleted_at is null${where ? ` and ${where}` : ""}`);
    const dbById = new Map(db.map((r) => [String(r[c.col]), r]));
    const apiById = new Map(items.map((i) => [String(i[c.id]), i]));

    // En una muestra no se espera ver toda la tabla: solo importa que lo que llegó exista y coincida.
    const missing = partial ? [] : [...dbById.keys()].filter((id) => !apiById.has(id));
    const extra = [...apiById.keys()].filter((id) => !dbById.has(id));
    const diffs = [];
    const push = (text) => { if (diffs.length < 5) diffs.push(text); };
    for (const [id, api] of apiById) {
        const row = dbById.get(id);
        if (!row) continue;
        for (const [key, col] of Object.entries(c.fields)) {
            if (norm(api[key]) !== norm(row[col])) push(`${c.id} ${id}: ${key} API=${JSON.stringify(api[key])} BD=${JSON.stringify(row[col])}`);
        }
        for (const [key, col] of Object.entries(enc)) {
            if (!api[key]) continue;
            if (String(api[key]).startsWith("enc:")) push(`${c.id} ${id}: ${key} llega cifrado por la API`);
            else if (!String(row[col] ?? "").startsWith("enc:")) push(`${c.id} ${id}: ${key} está en claro en la BD`);
        }
    }
    const leaked = c.forbidden
        ? [...new Set(items.slice(0, 200).flatMap((i) => Object.keys(i).filter((k) => c.forbidden.test(k))))]
        : [];
    return { db: db.length, missing, extra, diffs, leaked };
}

/**
 * Registra los escenarios de lectura de una lista de colecciones, con Super Admin y con Admin de sede.
 * Debe llamarse dentro de un `describe` ya habilitado (LIVE); `bootWeb` lo hace quien lo llama.
 */
export function registerReads(collections, { superAdmin, siteAdmin, groupSuper, groupAdmin, withAdmin = true }) {
    describe("Super Administrador: cada lista es toda la tabla", () => {
        beforeAll(async () => { await loginAs(superAdmin); });

        collections.forEach((c) => {
            scenario(groupSuper, `Super Admin · lista de ${c.name}`, async (L) => {
                const partial = Boolean(c.sample);
                const items = await fetchList(c, { sample: partial });
                const ids = items.map((i) => String(i[c.id]));
                expect(new Set(ids).size).toBe(ids.length); // la web no repite filas
                L.layer = "bd";
                const r = compare(c, items, partial ? `${c.col} in (${ids.map(Number).join(",") || "0"})` : "", { partial });
                const totalDb = partial ? one(`select count(*)::int as n from ${c.table} where deleted_at is null`).n : r.db;
                L.note = partial
                    ? `Muestra de ${items.length} filas de ${totalDb} vivas en la BD (la web nunca baja esta tabla completa); todas existen en la BD con los mismos valores.`
                    : `${items.length} filas por la API y ${r.db} vivas en la BD${c.enc ? "; datos personales cifrados en la BD" : ""}.`;
                expect({ faltan: r.missing.slice(0, 5), sobran: r.extra.slice(0, 5), valores: r.diffs, clavesProhibidas: r.leaked })
                    .toEqual({ faltan: [], sobran: [], valores: [], clavesProhibidas: [] });
            });
        });
    });

    if (!withAdmin) return;

    describe("Admin de sede: cada lista llega acotada a su sede", () => {
        const ctx = {};

        beforeAll(async () => {
            const session = await loginAs(siteAdmin);
            const { academicApi } = require("../academicApi");
            const list = await academicApi.listSchools();
            ctx.s = Number(pick((Array.isArray(list) ? list : list?.content ?? [])[0], "schoolId", "school_id"));
            expect(Number.isInteger(ctx.s)).toBe(true);
            const userId = pick(session, "userId", "user_id");
            const me = userId ? one(`select person_id from identity.app_user where user_id = '${String(userId).replace(/'/g, "")}'`) : null;
            ctx.actors = `(select academic_actor_id from academic.academic_actor where school_id = ${ctx.s} and deleted_at is null)`;
            ctx.persons = `(select person_id from academic.academic_actor where school_id = ${ctx.s} and deleted_at is null${me ? ` union select '${me.person_id}'::uuid` : ""})`;
        });

        collections.filter((c) => c.scope).forEach((c) => {
            scenario(groupAdmin, `Admin de sede · lista de ${c.name}`, async (L) => {
                const items = await fetchList(c);
                const ids = items.map((i) => String(i[c.id]));
                expect(new Set(ids).size).toBe(ids.length);
                L.layer = "bd";
                const r = compare(c, items, c.scope(ctx));
                const total = one(`select count(*)::int as n from ${c.table} where deleted_at is null`).n;
                L.note = `${items.length} filas por la API y ${r.db} de su sede en la BD (de ${total} en total).`;
                expect({ deOtrasSedes: r.extra.slice(0, 5), faltan: r.missing.slice(0, 5), valores: r.diffs, clavesProhibidas: r.leaked })
                    .toEqual({ deOtrasSedes: [], faltan: [], valores: [], clavesProhibidas: [] });
            });
        });
    });
}
