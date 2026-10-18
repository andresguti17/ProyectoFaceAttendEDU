jest.mock("../schedulingApi", () => ({
    schedulingApi: {
        createEnvironment: jest.fn(),
        updateEnvironment: jest.fn(),
        deleteEnvironment: jest.fn(),
    },
}));
jest.mock("../academicApi", () => ({
    academicApi: {
        listSchools: jest.fn(),
    },
}));

import { academicApi } from "../academicApi";
import { schedulingApi } from "../schedulingApi";
import {
    backendEnvId,
    createEnvironment,
    deleteEnvironment,
    updateEnvironment,
} from "../environmentManagement";

beforeEach(() => {
    jest.clearAllMocks();
    academicApi.listSchools.mockResolvedValue([{ schoolId: 2 }]);
});

test("backendEnvId accepts numeric ids and rejects local ones", () => {
    expect(backendEnvId("12")).toBe(12);
    expect(backendEnvId(12)).toBe(12);
    expect(backendEnvId("env_123_abc")).toBeNull();
    expect(backendEnvId("")).toBeNull();
    expect(backendEnvId("0")).toBeNull();
});

test("creates the environment with the session school", async () => {
    schedulingApi.createEnvironment.mockResolvedValue({ environmentId: 9 });

    const mirror = await createEnvironment({
        schoolId: 2,
        code: "A-101",
        name: "Aula 101",
        capacity: "30",
    });

    expect(schedulingApi.createEnvironment).toHaveBeenCalledWith({
        schoolId: 2,
        code: "A-101",
        name: "Aula 101",
        capacity: 30,
        status: true,
    });
    expect(mirror.id).toBe("9");
});

test("falls back to the only school when the session has none", async () => {
    schedulingApi.createEnvironment.mockResolvedValue({ environmentId: 1 });

    await createEnvironment({ schoolId: null, code: "B-1", name: "B", capacity: 10 });

    expect(schedulingApi.createEnvironment).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: 2 })
    );
});

test("rejects non-positive capacity before calling the backend", async () => {
    await expect(
        createEnvironment({ schoolId: 2, code: "A", name: "A", capacity: 0 })
    ).rejects.toThrow("Capacity must be a positive number");
    expect(schedulingApi.createEnvironment).not.toHaveBeenCalled();
});

test("update and delete forward numeric ids only", async () => {
    await updateEnvironment("12", { code: "A-102", capacity: 40 });
    expect(schedulingApi.updateEnvironment).toHaveBeenCalledWith(12, {
        code: "A-102",
        capacity: 40,
    });

    await deleteEnvironment("12");
    expect(schedulingApi.deleteEnvironment).toHaveBeenCalledWith(12);

    await expect(updateEnvironment("env_x", { code: "A" })).rejects.toThrow("not synced");
    await expect(deleteEnvironment("env_x")).rejects.toThrow("not synced");
});
