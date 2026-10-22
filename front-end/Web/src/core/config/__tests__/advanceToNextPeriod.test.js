import { advanceToNextPeriod, getInstitutionConfig, saveInstitutionConfig } from "../institutionConfig";

beforeEach(() => {
    localStorage.clear();
});

describe("advanceToNextPeriod", () => {
    test("moves the period dates forward and returns them, so the caller can save them for the whole school", async () => {
        saveInstitutionConfig({ isAutomaticPeriod: true, periodStartDate: "2026-01-01", periodEndDate: "2026-03-31" });

        const dates = await advanceToNextPeriod();

        expect(dates).toEqual({ periodStartDate: "2026-04-01", periodEndDate: "2026-06-28" });
        expect(getInstitutionConfig()).toMatchObject(dates);
    });

    test("does nothing in manual mode", async () => {
        saveInstitutionConfig({ isAutomaticPeriod: false, periodStartDate: "2026-01-01", periodEndDate: "2026-03-31" });

        expect(await advanceToNextPeriod()).toBeNull();
        expect(getInstitutionConfig().periodEndDate).toBe("2026-03-31");
    });

    test("does nothing without both dates", async () => {
        saveInstitutionConfig({ isAutomaticPeriod: true, periodStartDate: null, periodEndDate: null });

        expect(await advanceToNextPeriod()).toBeNull();
    });
});
