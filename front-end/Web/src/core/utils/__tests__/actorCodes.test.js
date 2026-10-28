import { nextActorCode } from "../actorCodes";

const actor = (actorTypeId, schoolId, actorCode) => ({ actorTypeId, schoolId, actorCode });

describe("nextActorCode", () => {
    test("primer administrador de la sede", () => {
        expect(nextActorCode([], { role: "admin", schoolId: "4", schoolShort: "ICT" })).toBe("ADM-ICT-001");
    });

    test("correlativo tras el mayor existente del mismo tipo y sede", () => {
        const actors = [
            actor(3, 4, "ADM-ICT-001"),
            actor(3, 4, "ADM-ICT-007"),
            actor(3, 5, "ADM-ICT-050"), // otra sede
            actor(2, 4, "ADM-ICT-090"), // otro tipo de actor
        ];
        expect(nextActorCode(actors, { role: "admin", schoolId: "4", schoolShort: "ICT" })).toBe("ADM-ICT-008");
    });

    test("docente conserva el formato DOC-{sede}-NNN", () => {
        const actors = [actor(2, 4, "DOC-ICT-041"), { actor_type_id: 2, school_id: 4, actorCode: "DOC-ICT-042" }];
        expect(nextActorCode(actors, { role: "teacher", schoolId: "4", schoolShort: "ICT" })).toBe("DOC-ICT-043");
    });
});
