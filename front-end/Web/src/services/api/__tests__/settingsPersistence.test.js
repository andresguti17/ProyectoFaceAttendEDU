jest.mock("../configurationApi", () => ({
    configurationApi: {
        schoolConfigurations: jest.fn(),
        listSecurity: jest.fn(),
        listSecurityPublic: jest.fn(),
        createAcademic: jest.fn(),
        updateAcademic: jest.fn(),
        createSecurity: jest.fn(),
        updateSecurity: jest.fn(),
    },
}));

jest.mock("../../../core/config/institutionConfig", () => ({
    getDefaultInstitutionConfig: jest.fn(),
    getInstitutionConfig: jest.fn(),
    saveInstitutionConfig: jest.fn(() => true),
}));

import { configurationApi } from "../configurationApi";
import {
    getDefaultInstitutionConfig,
    getInstitutionConfig,
    saveInstitutionConfig,
} from "../../../core/config/institutionConfig";
import {
    loadBackendOverrides,
    syncInstitutionConfigFromBackend,
    parseSetting,
    pushInstitutionConfig,
    stringifySetting,
} from "../settingsPersistence";

beforeEach(() => {
    jest.clearAllMocks();
    configurationApi.schoolConfigurations.mockResolvedValue([]);
    configurationApi.listSecurity.mockResolvedValue([]);
    configurationApi.listSecurityPublic.mockResolvedValue([]);
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
        { configurationName: "login.max.attempts", configurationValue: "10" },
    ]);

    const overrides = await loadBackendOverrides(2);

    expect(overrides).toEqual({ minAttendance: "75" });
});

test("writes a key shared by two fields only once (no duplicate POST against the per-school UNIQUE)", async () => {
    await pushInstitutionConfig(2, { confidence: 90, confidenceThreshold: 90 });

    expect(configurationApi.createAcademic).toHaveBeenCalledTimes(1);
    expect(configurationApi.createAcademic).toHaveBeenCalledWith({
        schoolId: 2,
        configurationName: "web.facial_confidence",
        configurationValue: "90",
    });
});

test("a school admin never touches the global security keys", async () => {
    await pushInstitutionConfig(2, { minAttendance: 80, sessionTime: "45", twoFactor: true }, { canWriteSecurity: false });

    expect(configurationApi.listSecurity).not.toHaveBeenCalled();
    expect(configurationApi.createSecurity).not.toHaveBeenCalled();
    expect(configurationApi.updateSecurity).not.toHaveBeenCalled();
    expect(configurationApi.createAcademic).toHaveBeenCalledTimes(1);
});

test("overrides keep the school keys when the caller cannot read the global security ones", async () => {
    configurationApi.schoolConfigurations.mockResolvedValue([
        { configurationName: "web.min_attendance", configurationValue: "75" },
    ]);
    configurationApi.listSecurityPublic.mockRejectedValue(new Error("down"));

    expect(await loadBackendOverrides(2)).toEqual({ minAttendance: "75" });
});

describe("syncInstitutionConfigFromBackend", () => {
    const DEFAULTS = { minAttendance: 80, confidenceThreshold: 85, emailAlert: true };
    const SCHOOL_KEY = "faceattend_institution_school";

    beforeEach(() => {
        localStorage.clear();
        getDefaultInstitutionConfig.mockReturnValue({ ...DEFAULTS });
        getInstitutionConfig.mockReturnValue({ ...DEFAULTS, minAttendance: 50 });
    });

    test("does nothing without a school", async () => {
        expect(await syncInstitutionConfigFromBackend(null)).toBe(false);
        expect(saveInstitutionConfig).not.toHaveBeenCalled();
    });

    test("applies the school values on top of the local config, typed after the local value", async () => {
        localStorage.setItem(SCHOOL_KEY, "2");
        configurationApi.schoolConfigurations.mockResolvedValue([
            { configurationName: "web.min_attendance", configurationValue: "75" },
            { configurationName: "web.facial_confidence", configurationValue: "92" },
        ]);

        await syncInstitutionConfigFromBackend(2);

        expect(saveInstitutionConfig).toHaveBeenCalledWith(
            expect.objectContaining({ minAttendance: 75, confidenceThreshold: 92 })
        );
    });

    test("starts from the defaults when the stored values belong to another school", async () => {
        localStorage.setItem(SCHOOL_KEY, "1");

        await syncInstitutionConfigFromBackend(2);

        expect(saveInstitutionConfig).toHaveBeenCalledWith(expect.objectContaining({ minAttendance: 80 }));
        expect(localStorage.getItem(SCHOOL_KEY)).toBe("2");
    });
});

test("every role gets the session time from the public security list, without touching the full list", async () => {
    configurationApi.schoolConfigurations.mockResolvedValue([
        { configurationName: "web.min_attendance", configurationValue: "75" },
    ]);
    configurationApi.listSecurityPublic.mockResolvedValue([
        { configurationName: "web.session_time", configurationValue: "30" },
    ]);

    expect(await loadBackendOverrides(2)).toEqual({ minAttendance: "75", sessionTime: "30" });
    expect(configurationApi.listSecurity).not.toHaveBeenCalled();
});

test("the native tardy_tolerance_minutes key is the school tolerance for marking late", async () => {
    configurationApi.schoolConfigurations.mockResolvedValue([
        { configurationName: "tardy_tolerance_minutes", configurationValue: "10" },
    ]);

    expect(await loadBackendOverrides(2)).toEqual({ tardyToleranceMinutes: "10" });
});
