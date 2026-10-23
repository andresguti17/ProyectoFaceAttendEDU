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
