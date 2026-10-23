import { formatClockTime, formatDate, formatDateTime, formatTime } from "../dateFormats";
import { saveInstitutionConfig, getInstitutionConfig } from "../../config/institutionConfig";

const setFormats = (dateFormat, timeFormat24h) =>
    saveInstitutionConfig({ ...getInstitutionConfig(), dateFormat, timeFormat24h });

const when = new Date(2026, 9, 5, 15, 7);

afterEach(() => localStorage.clear());

test("without explicit arguments, dates and times follow the configured format", () => {
    setFormats("MM/DD/YYYY", false);
    expect(formatDate(when)).toBe("10/05/2026");
    expect(formatTime(when)).toBe("3:07 PM");
    expect(formatDateTime(when)).toBe("10/05/2026 3:07 PM");
    expect(formatClockTime("15:07:00")).toBe("3:07 PM");

    setFormats("YYYY-MM-DD", true);
    expect(formatDate(when)).toBe("2026-10-05");
    expect(formatTime(when)).toBe("15:07");
    expect(formatClockTime("08:00:00")).toBe("08:00");
});

test("an explicit format still wins over the configured one", () => {
    setFormats("YYYY-MM-DD", true);
    expect(formatDate(when, "DD/MM/YYYY")).toBe("05/10/2026");
    expect(formatTime(when, false)).toBe("3:07 PM");
});
