jest.mock("../configurationApi", () => ({
    configurationApi: {
        schoolConfigurations: jest.fn(),
        listSecurity: jest.fn(),
        createAcademic: jest.fn(),
        updateAcademic: jest.fn(),
        createSecurity: jest.fn(),
        updateSecurity: jest.fn(),
    },
}));

import { configurationApi } from "../configurationApi";
import {
    loadBackendOverrides,
    parseSetting,
    pushInstitutionConfig,
    stringifySetting,
} from "../settingsPersistence";

beforeEach(() => {
    jest.clearAllMocks();
    configurationApi.schoolConfigurations.mockResolvedValue([]);
    configurationApi.listSecurity.mockResolvedValue([]);
});

test("stringifies booleans and numbers as strings", () => {
    expect(stringifySetting(true)).toBe("true");
    expect(stringifySetting(80)).toBe("80");
    expect(parseSetting("true", false)).toBe(true);
    expect(parseSetting("60", 30)).toBe(60);
    expect(parseSetting("nope", 30)).toBe(30);
    expect(parseSetting("", "keep")).toBe("keep");
});

test("creates missing keys and updates existing ones", async () => {
    configurationApi.schoolConfigurations.mockResolvedValue([
        { configurationId: 1, configurationName: "web.min_attendance", configurationValue: "70" },
    ]);
    configurationApi.listSecurity.mockResolvedValue([
        { configurationId: 9, configurationName: "web.session_time", configurationValue: "30" },
    ]);

    await pushInstitutionConfig(2, {
        minAttendance: 80,
        emailAlert: true,
        sessionTime: "60",
        twoFactor: false,
    });

    expect(configurationApi.updateAcademic).toHaveBeenCalledWith(1, {
        configurationValue: "80",
    });
    expect(configurationApi.createAcademic).toHaveBeenCalledWith({
        schoolId: 2,
        configurationName: "web.notify_email_alert",
        configurationValue: "true",
    });
    expect(configurationApi.updateSecurity).toHaveBeenCalledWith(9, {
        configurationValue: "60",
    });
    expect(configurationApi.createSecurity).toHaveBeenCalledWith({
        configurationName: "web.two_factor",
        configurationValue: "false",
    });
});

test("without school only persists the global security keys", async () => {
    await pushInstitutionConfig(null, {
        minAttendance: 80,
        sessionTime: "45",
    });

    expect(configurationApi.schoolConfigurations).not.toHaveBeenCalled();
    expect(configurationApi.createAcademic).not.toHaveBeenCalled();
    expect(configurationApi.createSecurity).toHaveBeenCalledWith({
        configurationName: "web.session_time",
        configurationValue: "45",
    });
});

test("loads backend overrides keyed by institution field", async () => {
    configurationApi.schoolConfigurations.mockResolvedValue([
        { configurationName: "web.min_attendance", configurationValue: "75" },
        { configurationName: "tardy_tolerance_minutes", configurationValue: "10" },
    ]);

    const overrides = await loadBackendOverrides(2);

    expect(overrides).toEqual({ minAttendance: "75" });
});
