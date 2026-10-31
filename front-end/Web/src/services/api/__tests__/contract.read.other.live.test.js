/**
 * Contrato web ⇄ endpoint ⇄ BD, LECTURAS de identidad, autorización, asistencia, configuración y
 * notificaciones, contra el stack local (docker compose).
 *
 * Mismas comparaciones que las lecturas académicas (testing/readCollections.js) y, además:
 *   · los datos personales (documento y correo) llegan en claro por la API y están cifrados en la BD
 *   · las respuestas de personas y usuarios no traen hashes ni secretos
 *   · el Admin de sede solo recibe personas, usuarios, asistencia, justificaciones, alertas y casos
 *     biométricos de su sede
 *
 *   node verificar-contrato.mjs
 */
import { LIVE, bootWeb, flushReport, readCredentials } from "../testing/contractHarness";
import { OTHER } from "../testing/collections";
import { registerReads } from "../testing/readCollections";

const run = LIVE ? describe : describe.skip;

run("contrato web ⇄ endpoint ⇄ BD: lecturas de identidad, asistencia, configuración y notificaciones", () => {
    let restoreFetch;

    beforeAll(() => { restoreFetch = bootWeb(); });
    afterAll(() => { flushReport("read-other"); restoreFetch?.(); });

    registerReads(OTHER, {
        superAdmin: readCredentials(".cuentas.local", "admin.faceattend"),
        siteAdmin: readCredentials(".cuentas.qa", "ADM"),
        groupSuper: "Lecturas de identidad, asistencia y más (Super Admin)",
        groupAdmin: "Lecturas de identidad, asistencia y más (Admin de sede)",
    });
});
