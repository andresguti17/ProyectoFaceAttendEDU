jest.mock("../academicApi", () => ({ academicApi: {} }));
jest.mock("../settingsPersistence", () => ({ pushInstitutionConfig: jest.fn() }));
jest.mock("../referenceData", () => ({ resetReferenceData: jest.fn() }));

import { currentPeriodOf, periodNameFor } from "../periodSync";
import { validatePeriodDates } from "../../../core/constants/academicPeriods";

test("the current period is the active one not yet over that starts first", () => {
    const periods = [
        { academicPeriodId: 1, isActive: true, startsOn: "2026-01-01", endsOn: "2026-03-31" },
        { academicPeriodId: 2, isActive: true, startsOn: "2026-10-01", endsOn: "2026-12-31" },
        { academicPeriodId: 3, isActive: false, startsOn: "2026-07-01", endsOn: "2026-09-30" },
    ];
    expect(currentPeriodOf(periods, "2026-02-10").academicPeriodId).toBe(1);
    expect(currentPeriodOf(periods, "2026-05-01").academicPeriodId).toBe(2);
    expect(currentPeriodOf(periods, "2027-01-01")).toBeNull();
});

test("the suggested name follows the period type", () => {
    expect(periodNameFor("semestral", "2026-07-01")).toBe("Segundo Semestre 2026");
    expect(periodNameFor("trimestral", "2026-01-15")).toBe("Primer Trimestre 2026");
    expect(periodNameFor("trimestral", "")).toBe("");
});

test("period dates follow the duration of the configured type", () => {
    expect(validatePeriodDates("2026-01-01", "2026-03-31", "trimestral")).toBeNull();
    expect(validatePeriodDates("2026-01-01", "2026-06-30", "trimestral")).toMatch(/3 meses/);
    expect(validatePeriodDates("2026-01-01", "2026-06-30", "semestral")).toBeNull();
    expect(validatePeriodDates("2026-01-01", "2026-01-10", "semestral")).toMatch(/28 días/);
    expect(validatePeriodDates("", "", "semestral")).toBeNull();
});

import { calendarPeriodDates, describePeriod } from "../../../core/constants/academicPeriods";

test("the calendar period splits the year by the configured type", () => {
    expect(calendarPeriodDates("semestral", new Date(2026, 9, 23))).toEqual({
        startIso: "2026-07-01",
        endIso: "2026-12-31",
        label: "Segundo Semestre 2026",
    });
    expect(calendarPeriodDates("anual", new Date(2026, 2, 1)).startIso).toBe("2026-01-01");
});

test("describePeriod uses valid dates, falls back to the calendar and reports status", () => {
    const today = new Date(2026, 9, 23);
    const own = describePeriod("2026-08-01", "2026-12-15", "semestral", today);
    expect(own).toMatchObject({ fromDates: true, status: "current", daysRemaining: 53 });
    const tooLong = describePeriod("2026-01-01", "2026-12-31", "trimestral", today);
    expect(tooLong).toMatchObject({ fromDates: false, startIso: "2026-10-01" });
    expect(describePeriod("2026-01-01", "2026-03-31", "trimestral", today).status).toBe("ended");
});
