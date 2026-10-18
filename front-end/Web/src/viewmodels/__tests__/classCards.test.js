jest.mock("../../services/api/referenceData", () => ({
    courseMap: jest.fn(),
    cohortMap: jest.fn(),
    listEnvironments: jest.fn(),
    cohortRoster: jest.fn(),
}));
jest.mock("../../services/api/schedulingApi", () => ({ schedulingApi: { listSessions: jest.fn() } }));
jest.mock("../../services/api/attendanceApi", () => ({ attendanceApi: { recordsBySession: jest.fn() } }));

import { courseMap, cohortMap, listEnvironments, cohortRoster } from "../../services/api/referenceData";
import { schedulingApi } from "../../services/api/schedulingApi";
import { attendanceApi } from "../../services/api/attendanceApi";
import { cardStatusOf, classTimeInfo, loadClassCards, shortTime, splitMinutes, toMinutes } from "../classCards";

const at = (h, m = 0) => new Date(2026, 9, 19, h, m);
const TODAY = "2026-10-19";

describe("time helpers", () => {
    test("toMinutes and shortTime accept HH:MM and HH:MM:SS", () => {
        expect(toMinutes("07:00:00")).toBe(420);
        expect(toMinutes("9:30")).toBe(570);
        expect(toMinutes("nope")).toBeNull();
        expect(shortTime("07:00:00")).toBe("07:00");
        expect(shortTime("9:30")).toBe("09:30");
    });

    test("splitMinutes", () => {
        expect(splitMinutes(125)).toEqual({ hours: 2, minutes: 5 });
        expect(splitMinutes(-4)).toEqual({ hours: 0, minutes: 0 });
    });

    test("a pending class counts down to its start, is due inside its window and missed after it", () => {
        expect(classTimeInfo("07:00", "09:00", "pending", at(6, 25))).toEqual({ kind: "starts_in", minutes: 35 });
        expect(classTimeInfo("07:00", "09:00", "pending", at(7, 30))).toEqual({ kind: "due", minutes: 0 });
        expect(classTimeInfo("07:00", "09:00", "pending", at(9, 10))).toEqual({ kind: "missed", minutes: 10 });
    });

    test("an open class shows what is left, then overtime", () => {
        expect(classTimeInfo("09:00", "11:00", "open", at(9, 50))).toEqual({ kind: "remaining", minutes: 70 });
        expect(classTimeInfo("09:00", "11:00", "open", at(11, 15))).toEqual({ kind: "overtime", minutes: 15 });
    });

    test("a closed class reports how long ago it ended", () => {
        expect(classTimeInfo("05:00", "06:30", "closed", at(9, 30))).toEqual({ kind: "ended_ago", minutes: 180 });
        expect(classTimeInfo("05:00", "06:30", "cancelled", at(5, 45))).toEqual({ kind: "duration", minutes: 90 });
    });

    test("unreadable times yield no hint instead of NaN", () => {
        expect(classTimeInfo("??", "09:00", "pending", at(8)).kind).toBe("none");
    });
});

test("cardStatusOf maps the session status", () => {
    expect(cardStatusOf(undefined)).toBe("pending");
    expect(cardStatusOf({ sessionStatus: "Open" })).toBe("open");
    expect(cardStatusOf({ sessionStatus: "Closed" })).toBe("closed");
    expect(cardStatusOf({ sessionStatus: "Cancelled" })).toBe("cancelled");
});

describe("loadClassCards", () => {
    const blocks = [
        { scheduleBlockId: 1, courseId: 10, cohortId: 25, environmentId: 4 },
        { scheduleBlockId: 2, courseId: 11, cohortId: 26, environmentId: 5 },
        { scheduleBlockId: 3, courseId: 12, cohortId: 26, environmentId: 5 },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        courseMap.mockResolvedValue(
            new Map([
                [10, { name: "Controlar la calidad", code: "CCS" }],
                [11, { name: "Diseñar la solución", code: "DSS" }],
                [12, { name: "Desarrollar", code: "DSW" }],
            ])
        );
        cohortMap.mockResolvedValue(new Map([[25, { code: "3145556" }], [26, { code: "3145555" }]]));
        listEnvironments.mockResolvedValue([
            { environmentId: 4, name: "Aula 204", capacity: 30 },
            { environmentId: 5, name: "Laboratorio 2", capacity: 25 },
        ]);
        cohortRoster.mockImplementation(async (cohortId) =>
            Array.from({ length: cohortId === 25 ? 23 : 4 }, (_, i) => ({ academicActorId: i }))
        );
        schedulingApi.listSessions.mockResolvedValue([
            { classSessionId: 51, scheduleBlockId: 2, sessionDate: TODAY, sessionStatus: "Open" },
            { classSessionId: 52, scheduleBlockId: 3, sessionDate: TODAY, sessionStatus: "Closed" },
            { classSessionId: 53, scheduleBlockId: 1, sessionDate: "2026-10-12", sessionStatus: "Closed" }, // otro día
        ]);
        attendanceApi.recordsBySession.mockImplementation(async (id) =>
            id === 51
                ? [{ attendanceStatus: "Present" }, { attendanceStatus: "Late" }, { attendanceStatus: "Absent" }]
                : [{ attendanceStatus: "Present" }, { attendanceStatus: "Present" }, { attendanceStatus: "Present" }]
        );
    });

    test("joins course, ficha, environment, roster and today's session per block", async () => {
        const cards = await loadClassCards(blocks, TODAY);

        expect(cards.get(1)).toEqual({
            courseName: "Controlar la calidad",
            courseCode: "CCS",
            fichaCode: "3145556",
            environmentName: "Aula 204",
            capacity: 30,
            enrolled: 23,
            status: "pending", // la sesión del 12 de octubre no es la de hoy
            registered: null,
        });
        expect(cards.get(2)).toMatchObject({ status: "open", registered: 2, enrolled: 4, environmentName: "Laboratorio 2" });
        expect(cards.get(3)).toMatchObject({ status: "closed", registered: 3 });
        expect(attendanceApi.recordsBySession).toHaveBeenCalledTimes(2); // solo abiertas/cerradas de hoy
    });

    test("each source can fail without emptying the card", async () => {
        courseMap.mockRejectedValue(new Error("down"));
        listEnvironments.mockRejectedValue(new Error("down"));
        schedulingApi.listSessions.mockRejectedValue(new Error("down"));
        cohortRoster.mockRejectedValue(new Error("down"));

        const cards = await loadClassCards(blocks.slice(0, 1), TODAY);

        expect(cards.get(1)).toEqual({
            courseName: "",
            courseCode: "",
            fichaCode: "3145556",
            environmentName: "",
            capacity: null,
            enrolled: 0,
            status: "pending",
            registered: null,
        });
    });

    test("a failing attendance lookup leaves the count unknown instead of zero", async () => {
        attendanceApi.recordsBySession.mockRejectedValue(new Error("down"));

        const cards = await loadClassCards(blocks.slice(1, 2), TODAY);

        expect(cards.get(2)).toMatchObject({ status: "open", registered: null });
    });
});
