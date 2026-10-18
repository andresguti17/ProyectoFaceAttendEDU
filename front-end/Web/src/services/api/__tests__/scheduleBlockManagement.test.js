jest.mock("../schedulingApi", () => ({
    schedulingApi: {
        createBlock: jest.fn(),
        deleteBlock: jest.fn(),
    },
}));
jest.mock("../referenceData", () => ({
    listActors: jest.fn(),
    listCohorts: jest.fn(),
    listCourses: jest.fn(),
}));

import { schedulingApi } from "../schedulingApi";
import { listActors, listCohorts, listCourses } from "../referenceData";
import {
    backendScheduleId,
    cohortsForCourse,
    createBlocks,
    createdBlockId,
    dayLabelToIso,
    deleteBlock,
    instructorActorForUser,
    isoToDayLabel,
    replaceBlock,
} from "../scheduleBlockManagement";

beforeEach(() => {
    jest.clearAllMocks();
});

test("ids distinguish backend rows from local ones", () => {
    expect(backendScheduleId("45")).toBe(45);
    expect(backendScheduleId("sch_1")).toBeNull();
    expect(backendScheduleId("")).toBeNull();
});

test("day labels map to ISO 1..7", () => {
    expect(dayLabelToIso("Lun")).toBe(1);
    expect(dayLabelToIso("Dom")).toBe(7);
    expect(dayLabelToIso("X")).toBeNull();
    expect(isoToDayLabel(3)).toBe("Mié");
});

test("lists active cohorts of the course program", async () => {
    listCourses.mockResolvedValue([{ courseId: 12, programId: 4, code: "MAT" }]);
    listCohorts.mockResolvedValue([
        { cohortId: 50, programId: 4, code: "F1", status: true },
        { cohortId: 51, programId: 4, code: "F2", status: false },
        { cohortId: 52, programId: 9, code: "F3", status: true },
    ]);

    await expect(cohortsForCourse("MAT")).resolves.toEqual([{ cohortId: 50, code: "F1" }]);
});

test("resolves the instructor actor from the form user id", async () => {
    listActors.mockResolvedValue([
        { academicActorId: 601, personId: "p-1", actorTypeId: 1 },
        { academicActorId: 602, personId: "p-1", actorTypeId: 2 },
    ]);
    const users = [{ id: "u-1", personId: "p-1" }];

    await expect(instructorActorForUser(users, "u-1")).resolves.toBe(602);
    await expect(instructorActorForUser(users, "u-9")).resolves.toBeNull();
});

test("creates one block per day with the backend contract", async () => {
    schedulingApi.createBlock.mockResolvedValue({ scheduleBlockId: 7 });

    const created = await createBlocks({
        environmentId: "501",
        courseId: 12,
        cohortId: 50,
        instructorActorId: 601,
        daysOfWeek: [1, 3],
        startsAt: "08:00",
        endsAt: "10:00",
    });

    expect(schedulingApi.createBlock).toHaveBeenCalledTimes(2);
    expect(schedulingApi.createBlock).toHaveBeenNthCalledWith(1, {
        environmentId: 501,
        courseId: 12,
        cohortId: 50,
        instructorActorId: 601,
        dayOfWeek: 1,
        startsAt: "08:00",
        endsAt: "10:00",
    });
    expect(createdBlockId(created[0])).toBe("7");
});

test("rejects incomplete payloads before calling the backend", async () => {
    await expect(
        createBlocks({
            environmentId: 501,
            courseId: 12,
            cohortId: null,
            instructorActorId: 601,
            daysOfWeek: [1],
            startsAt: "08:00",
            endsAt: "10:00",
        })
    ).rejects.toThrow("Missing block fields: cohortId");
    expect(schedulingApi.createBlock).not.toHaveBeenCalled();
});

test("replace creates first and then deletes the old block", async () => {
    schedulingApi.createBlock.mockResolvedValue({ scheduleBlockId: 8 });
    const order = [];
    schedulingApi.createBlock.mockImplementation(async () => {
        order.push("create");
        return { scheduleBlockId: 8 };
    });
    schedulingApi.deleteBlock.mockImplementation(async () => {
        order.push("delete");
    });

    await replaceBlock(5, {
        environmentId: 501,
        courseId: 12,
        cohortId: 50,
        instructorActorId: 601,
        daysOfWeek: [2],
        startsAt: "08:00",
        endsAt: "10:00",
    });

    expect(order).toEqual(["create", "delete"]);
    expect(schedulingApi.deleteBlock).toHaveBeenCalledWith(5);
});

test("delete forwards backend ids only", async () => {
    await deleteBlock("45");
    expect(schedulingApi.deleteBlock).toHaveBeenCalledWith(45);
    await expect(deleteBlock("sch_1")).rejects.toThrow("not synced");
});
