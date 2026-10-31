// La lista de usuarios se arma desde academic_actor: una cuenta sin actor no pertenece a ninguna sede
// y no aparece. El Super Administrador es global y sí debe verlas (marcadas como "sin sede"), si no
// una base con cuentas pero sin actores se ve vacía aunque tenga usuarios.
jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
}));
jest.mock("../../../services/api/referenceData", () => ({
    fullName: (p) => (p ? `${p.name} ${p.lastName}` : ""),
    instructorCourseNamesByPerson: jest.fn(async () => new Map()),
    listActors: jest.fn(),
    normalizeStatus: (s) => s,
    optional: (promise, fallback) => promise.catch(() => fallback),
    personMap: jest.fn(),
    rolesForUser: jest.fn(),
    rolesForUsers: jest.fn(),
    userByPersonMap: jest.fn(),
}));

import { loadUsers } from "../UserStorage";
import * as ref from "../../../services/api/referenceData";

const user = (n, role) => ({ userId: `u${n}`, personId: `p${n}`, username: `user${n}`, status: true, role });
const roleRows = { u1: [{ roleName: "Instructor" }], u2: [{ roleName: "Aprendiz" }], u3: [{ roleName: "Administrador" }] };

beforeEach(() => {
    // u1 tiene actor en la sede 7; u2 y u3 son cuentas sin actor.
    ref.listActors.mockResolvedValue([{ academicActorId: 11, personId: "p1", schoolId: 7, actorCode: "DOC-1" }]);
    ref.userByPersonMap.mockResolvedValue(new Map([["p1", user(1)], ["p2", user(2)], ["p3", user(3)]]));
    ref.personMap.mockResolvedValue(new Map([1, 2, 3].map((n) => [`p${n}`, { name: `Persona${n}`, lastName: "Prueba" }])));
    ref.rolesForUsers.mockImplementation(async (ids) => new Map(ids.map((id) => [id, roleRows[id]])));
});

describe("loadUsers: cuentas sin sede", () => {
    it("por defecto solo lista las cuentas con actor (lo que ve un Administrador de sede)", async () => {
        const rows = await loadUsers();
        expect(rows.map((r) => r.id)).toEqual(["u1"]);
    });

    it("con includeUnassigned agrega las cuentas sin actor, sin sede, y no repite las que sí tienen", async () => {
        const rows = await loadUsers({ includeUnassigned: true });
        expect(rows.map((r) => r.id)).toEqual(["u1", "u2", "u3"]);
        const withActor = rows.find((r) => r.id === "u1");
        expect(withActor).toMatchObject({ schoolId: "7", actorId: 11, actorCode: "DOC-1", role: "teacher" });
        for (const id of ["u2", "u3"]) {
            expect(rows.find((r) => r.id === id)).toMatchObject({ schoolId: null, actorId: null, actorCode: "" });
        }
        expect(rows.find((r) => r.id === "u2").role).toBe("student");
        expect(rows.find((r) => r.id === "u3").role).toBe("admin");
    });

    it("sin actores en toda la base, includeUnassigned devuelve todas las cuentas", async () => {
        ref.listActors.mockResolvedValue([]);
        expect(await loadUsers()).toEqual([]);
        expect((await loadUsers({ includeUnassigned: true })).map((r) => r.id)).toEqual(["u1", "u2", "u3"]);
    });
});
