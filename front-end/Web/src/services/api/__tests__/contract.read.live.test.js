/**
 * Contrato web ⇄ endpoint ⇄ BD, LECTURAS ACADÉMICAS (escuelas, programas, períodos, fichas, cursos,
 * actores, matrículas, ambientes y bloques), contra el stack local (docker compose).
 *
 * Para cada colección se baja la lista completa como lo hace la web y se compara con PostgreSQL
 * (ver testing/readCollections.js). Con el Super Administrador se espera toda la tabla; con el
 * Admin de sede, solo las filas de su sede.
 *
 *   node verificar-contrato.mjs
 */
import { LIVE, bootWeb, flushReport, readCredentials } from "../testing/contractHarness";
import { ACADEMIC } from "../testing/collections";
import { registerReads } from "../testing/readCollections";

const run = LIVE ? describe : describe.skip;

run("contrato web ⇄ endpoint ⇄ BD: lecturas académicas", () => {
    let restoreFetch;

    beforeAll(() => { restoreFetch = bootWeb(); });
    afterAll(() => { flushReport("read"); restoreFetch?.(); });

    registerReads(ACADEMIC, {
        superAdmin: readCredentials(".cuentas.local", "admin.faceattend"),
        siteAdmin: readCredentials(".cuentas.qa", "ADM"),
        groupSuper: "Lecturas (Super Admin)",
        groupAdmin: "Lecturas (Admin de sede)",
    });
});
