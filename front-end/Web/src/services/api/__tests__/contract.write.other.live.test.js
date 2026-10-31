/**
 * Contrato web ⇄ endpoint ⇄ BD, ESCRITURAS de tipos de justificación y configuración, contra el
 * stack local (docker compose).
 *
 *   · tipos de justificación: el Admin de sede crea, edita y borra los de SU sede; no puede crear,
 *     editar ni borrar los globales (school_id nulo) ni duplicar un nombre dentro de su sede o de los globales
 *   · configuración: el Admin de sede guarda su configuración académica con las funciones de la web
 *     (una fila por nombre y sede, sin duplicar) y no puede escribir la de seguridad ni la de otra sede
 *
 * Los registros de seguridad que se envían en las pruebas llevan el mismo valor que ya tienen: si un
 * rol sin permiso lograra escribirlos, no cambia nada. Lo creado lleva el prefijo CT y se borra de
 * forma lógica al terminar.
 *
 *   node verificar-contrato.mjs
 */
import {
    LIVE, bootWeb, exec, flushReport, lastWire, lit, loginAs, one, pick, readCredentials, rid, scenario, sql,
} from "../testing/contractHarness";

const run = LIVE ? describe : describe.skip;
const G = "Escrituras (justificaciones y configuración)";

async function rejected(promise, statuses) {
    let error;
    try { await promise; } catch (e) { error = e; }
    if (!error) throw new Error(`se esperaba un rechazo ${statuses.join("/")} y la operación tuvo éxito`);
    if (!statuses.includes(error.status)) throw new Error(`se esperaba ${statuses.join("/")} y llegó ${error.status}: ${error.message}`);
    return error;
}

run("contrato web ⇄ endpoint ⇄ BD: escrituras de justificaciones y configuración", () => {
    let restoreFetch;
    let attendanceApi;
    let configurationApi;
    let settings;
    let ownId;
    const superAdmin = readCredentials(".cuentas.local", "admin.faceattend");
    const siteAdmin = readCredentials(".cuentas.qa", "ADM");
    const created = { types: [], configs: [] };

    beforeAll(async () => {
        restoreFetch = bootWeb();
        ({ attendanceApi } = require("../attendanceApi"));
        ({ configurationApi } = require("../configurationApi"));
        settings = require("../settingsPersistence");
        await loginAs(siteAdmin);
        const { academicApi } = require("../academicApi");
        const list = await academicApi.listSchools();
        ownId = Number(pick((Array.isArray(list) ? list : list?.content ?? [])[0], "schoolId", "school_id"));
    });

    afterAll(() => {
        exec(`update attendance.justification_type set deleted_at = now() where school_id is null and name like 'CT Global %' and deleted_at is null`);
        created.types.filter(Boolean).forEach((id) =>
            exec(`update attendance.justification_type set deleted_at = now() where justification_type_id = ${Number(id)} and deleted_at is null`));
        exec(`update configuration.academic_configuration set deleted_at = now() where school_id = ${Number(ownId)} and configuration_name like 'web.min_attendance' and deleted_at is null and created_at > now() - interval '1 hour'`);
        flushReport("write-other");
        restoreFetch?.();
    });

    describe("Tipos de justificación", () => {
        let typeId;
        let globalType;
        const body = () => ({ name: `CT Tipo ${rid}`, description: "Prueba de contrato", requiresAttachment: true, schoolId: ownId });

        beforeAll(async () => {
            await loginAs(siteAdmin);
            globalType = one(`select justification_type_id, name, description, requires_attachment, status from attendance.justification_type where school_id is null and deleted_at is null limit 1`);
        });

        scenario(G, "Admin de sede · POST /justification-types (de su sede)", async (L) => {
            const res = await attendanceApi.createJustificationType(body());
            typeId = pick(res, "justificationTypeId", "justification_type_id", "id");
            created.types.push(typeId);
            expect(lastWire().status).toBe(201);
            expect(lastWire().request).toEqual(body());
            expect(res).toMatchObject({ name: body().name, requiresAttachment: true });
            L.layer = "bd";
            expect(one(`select * from attendance.justification_type where justification_type_id = ${Number(typeId)}`)).toMatchObject({
                school_id: ownId, name: body().name, description: "Prueba de contrato", requires_attachment: true, status: true, deleted_at: null,
            });
            L.note = "El tipo queda en su sede, con el adjunto obligatorio que mandó la web.";
        });

        scenario(G, "Admin de sede · POST /justification-types con un nombre que ya existe en su sede", async (L) => {
            await rejected(attendanceApi.createJustificationType(body()), [400, 409, 422]);
            L.layer = "bd";
            expect(one(`select count(*)::int as n from attendance.justification_type where school_id = ${ownId} and name = ${lit(body().name)} and deleted_at is null`).n).toBe(1);
            L.note = "El endpoint rechaza el duplicado y la BD sigue con una sola fila.";
        });

        scenario(G, "Admin de sede · un tipo de su sede con el mismo nombre que uno global", async (L) => {
            expect(globalType).not.toBeNull();
            // El modelo (regla 6) prohíbe duplicados dentro de una sede y entre los propios globales; un tipo de sede
            // puede llamarse como uno global.
            const res = await attendanceApi.createJustificationType({ name: globalType.name, description: null, requiresAttachment: false, schoolId: ownId });
            const id = pick(res, "justificationTypeId", "justification_type_id", "id");
            created.types.push(id);
            expect(lastWire().status).toBe(201);
            L.layer = "bd";
            expect(one(`select school_id, name, deleted_at from attendance.justification_type where justification_type_id = ${Number(id)}`)).toMatchObject({
                school_id: ownId, name: globalType.name, deleted_at: null,
            });
            L.note = "Permitido por el modelo: la fila nace en la sede y el tipo global no se toca.";
        });

        scenario(G, "Admin de sede · POST /justification-types global (schoolId nulo)", async (L) => {
            const name = `CT Global ${rid}`;
            let res;
            let error;
            try { res = await attendanceApi.createJustificationType({ name, description: null, requiresAttachment: false, schoolId: null }); } catch (e) { error = e; }
            const row = one(`select justification_type_id, school_id from attendance.justification_type where name = ${lit(name)} and deleted_at is null`);
            if (row) created.types.push(row.justification_type_id);
            if (res) created.types.push(pick(res, "justificationTypeId", "id"));
            expect(error?.status).toBe(403);
            L.layer = "bd";
            expect(row).toBeNull();
            L.note = "Solo el Super Admin crea tipos globales: el Admin de sede recibe 403 y no queda ninguna fila sin sede.";
        });

        scenario(G, "Admin de sede · PUT /justification-types/:id (de su sede)", async (L) => {
            const patch = { ...body(), name: `CT Tipo ${rid} v2`, description: "Editado", requiresAttachment: false };
            await attendanceApi.updateJustificationType(typeId, patch);
            expect(lastWire().status).toBe(200);
            expect(lastWire().request).toEqual(patch);
            L.layer = "bd";
            expect(one(`select * from attendance.justification_type where justification_type_id = ${Number(typeId)}`)).toMatchObject({
                school_id: ownId, name: patch.name, description: "Editado", requires_attachment: false, deleted_at: null,
            });
            L.note = "La edición de la web cambia nombre, descripción y adjunto sin sacar el tipo de su sede.";
        });

        scenario(G, "Admin de sede · PUT y DELETE de un tipo global", async (L) => {
            expect(globalType).not.toBeNull();
            await rejected(attendanceApi.updateJustificationType(globalType.justification_type_id, { name: `${globalType.name} X`, description: null, requiresAttachment: false, schoolId: ownId }), [403, 404]);
            await rejected(attendanceApi.deleteJustificationType(globalType.justification_type_id), [403, 404]);
            L.layer = "bd";
            expect(one(`select justification_type_id, name, description, requires_attachment, status from attendance.justification_type where justification_type_id = ${Number(globalType.justification_type_id)} and deleted_at is null`)).toEqual(globalType);
            L.note = "403 en ambos y el tipo global queda intacto y vivo.";
        });

        scenario(G, "Admin de sede · DELETE /justification-types/:id (de su sede)", async (L) => {
            await attendanceApi.deleteJustificationType(typeId);
            expect(lastWire().status).toBe(204);
            L.layer = "bd";
            const row = one(`select deleted_at from attendance.justification_type where justification_type_id = ${Number(typeId)}`);
            expect(row).not.toBeNull();
            expect(row.deleted_at).not.toBeNull();
            L.note = "Borrado lógico: la fila sigue con deleted_at.";
        });
    });

    describe("Tipos de justificación globales", () => {
        const name = `CT Global ${rid}`;

        beforeAll(async () => { await loginAs(superAdmin); });

        scenario(G, "Super Admin · POST /justification-types global", async (L) => {
            const res = await attendanceApi.createJustificationType({ name, description: null, requiresAttachment: false, schoolId: null });
            created.types.push(pick(res, "justificationTypeId", "justification_type_id", "id"));
            expect(lastWire().status).toBe(201);
            expect(lastWire().request).toEqual({ name, description: null, requiresAttachment: false, schoolId: null });
            L.layer = "bd";
            expect(one(`select school_id, name, deleted_at from attendance.justification_type where name = ${lit(name)}`)).toMatchObject({ school_id: null, name, deleted_at: null });
            L.note = "El tipo global queda sin sede (school_id nulo).";
        });

        scenario(G, "Super Admin · POST /justification-types global con un nombre que ya existe", async (L) => {
            await rejected(attendanceApi.createJustificationType({ name, description: null, requiresAttachment: false, schoolId: null }), [400, 409, 422]);
            L.layer = "bd";
            expect(one(`select count(*)::int as n from attendance.justification_type where school_id is null and name = ${lit(name)} and deleted_at is null`).n).toBe(1);
            L.note = "El endpoint rechaza el duplicado entre globales y la BD sigue con una sola fila (uq_justification_type_global_name).";
        });
    });

    describe("Configuración", () => {
        beforeAll(async () => { await loginAs(siteAdmin); });

        scenario(G, "Admin de sede · guardar la configuración académica de su sede", async (L) => {
            const before = one(`select count(*)::int as n from configuration.academic_configuration where school_id = ${ownId} and configuration_name = 'web.min_attendance' and deleted_at is null`).n;
            await settings.pushInstitutionConfig(ownId, { minAttendance: 77 }, { canWriteSecurity: false });
            expect(lastWire().status).toBe(before ? 200 : 201);
            expect(lastWire().request).toEqual(before ? { configurationValue: "77" } : { schoolId: ownId, configurationName: "web.min_attendance", configurationValue: "77" });
            L.layer = "bd";
            const rows = sql(`select configuration_id, configuration_value from configuration.academic_configuration where school_id = ${ownId} and configuration_name = 'web.min_attendance' and deleted_at is null`);
            expect(rows).toHaveLength(1);
            expect(rows[0].configuration_value).toBe("77");
            L.note = "La web guarda cada ajuste como texto, una fila por nombre y sede.";
        });

        scenario(G, "Admin de sede · guardar de nuevo actualiza la misma fila (sin duplicar)", async (L) => {
            await settings.pushInstitutionConfig(ownId, { minAttendance: 78 }, { canWriteSecurity: false });
            expect(lastWire().status).toBe(200);
            expect(lastWire().request).toEqual({ configurationValue: "78" });
            L.layer = "bd";
            const rows = sql(`select configuration_value from configuration.academic_configuration where school_id = ${ownId} and configuration_name = 'web.min_attendance' and deleted_at is null`);
            expect(rows).toEqual([{ configuration_value: "78" }]);
            L.note = "El segundo guardado hace PUT sobre la fila existente; el UNIQUE por sede y nombre no se rompe.";
        });

        scenario(G, "Admin de sede · crear configuración para otra sede", async (L) => {
            const other = one(`select school_id from academic.school where deleted_at is null and school_id <> ${ownId} limit 1`);
            if (!other) { L.note = "No hay otra sede para comparar."; return; }
            const name = `ct.otra_sede_${rid.toLowerCase()}`;
            await rejected(configurationApi.createAcademic({ schoolId: other.school_id, configurationName: name, configurationValue: "1" }), [403]);
            L.layer = "bd";
            expect(one(`select 1 as n from configuration.academic_configuration where configuration_name = ${lit(name)}`)).toBeNull();
            L.note = "403 y no queda ninguna fila en la configuración de la otra sede.";
        });

        scenario(G, "Admin de sede · escribir la configuración de seguridad", async (L) => {
            const row = one(`select configuration_id, configuration_value, row_version from configuration.security_configuration where deleted_at is null order by configuration_id limit 1`);
            await rejected(configurationApi.updateSecurity(row.configuration_id, { configurationValue: row.configuration_value }), [403]);
            expect(lastWire().request).toEqual({ configurationValue: row.configuration_value });
            L.layer = "bd";
            expect(one(`select configuration_id, configuration_value, row_version from configuration.security_configuration where configuration_id = ${Number(row.configuration_id)}`)).toEqual(row);
            L.note = "La seguridad es global: el Admin de sede recibe 403 y la fila no cambia (se envió su mismo valor).";
        });

        scenario(G, "Super Admin · escribir la configuración de seguridad", async (L) => {
            await loginAs(superAdmin);
            const row = one(`select configuration_id, configuration_name, configuration_value from configuration.security_configuration where deleted_at is null order by configuration_id limit 1`);
            const res = await configurationApi.updateSecurity(row.configuration_id, { configurationValue: row.configuration_value });
            expect(lastWire().status).toBe(200);
            expect(lastWire().request).toEqual({ configurationValue: row.configuration_value });
            expect(pick(res, "configurationValue", "configuration_value")).toBe(row.configuration_value);
            L.layer = "bd";
            expect(one(`select configuration_id, configuration_name, configuration_value from configuration.security_configuration where configuration_id = ${Number(row.configuration_id)}`)).toEqual(row);
            L.note = "El Super Admin puede escribirla; se envió el mismo valor, así que la fila queda igual.";
        });
    });
});
