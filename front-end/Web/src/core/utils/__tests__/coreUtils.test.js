// Utilidades usadas por las pantallas: fechas, validación de formularios, formato de texto,
// fortaleza de contraseña y período académico del aprendiz.
import { formatDate, formatTime, formatDateTime, getRelativeTime, isToday, parseDate } from "../dates";
import { isValidEmail, maxLength, isValidPhone, normalizePhone, isValidDate, birthDateError, validate } from "../validation";
import { formatNumber, formatPercentage, titleCase, normalizeText, slugify, trimDashes } from "../formatting";
import { validatePassword, getPasswordStrength, getPasswordStrengthLevel, getPasswordSuggestions } from "../passwordValidation";
import { calculateStudentCurrentPeriod, getStudentPeriodFromData } from "../studentPeriodCalculator";

describe("dates", () => {
    test("formatDate supports the three configured formats and rejects invalid input", () => {
        const d = new Date(2026, 8, 3, 14, 5);
        expect(formatDate(d)).toBe("03/09/2026");
        expect(formatDate(d, "MM/DD/YYYY")).toBe("09/03/2026");
        expect(formatDate(d, "YYYY-MM-DD")).toBe("2026-09-03");
        expect(formatDate(d, "otro")).toBe("03/09/2026");
        expect(formatDate("no es fecha")).toBe("");
        expect(formatDate(null)).toBe("");
        expect(formatTime(d)).toBe("14:05");
        expect(formatTime("x")).toBe("");
        expect(formatDateTime(d)).toBe("03/09/2026 14:05");
        expect(formatDateTime(null)).toBe("");
    });

    test("getRelativeTime picks the largest whole unit", () => {
        const ago = (ms) => new Date(Date.now() - ms);
        expect(getRelativeTime(ago(5_000))).toMatch(/ahora|now/i);
        expect(getRelativeTime(ago(3 * 60_000))).toMatch(/3/);
        expect(getRelativeTime(ago(5 * 3_600_000))).toMatch(/5/);
        expect(getRelativeTime(ago(3 * 86_400_000))).toMatch(/3/);
        expect(getRelativeTime(ago(65 * 86_400_000))).toMatch(/2/);
        expect(getRelativeTime(ago(800 * 86_400_000))).toMatch(/2/);
        expect(getRelativeTime("x")).toBe("");
        expect(getRelativeTime(null)).toBe("");
    });

    test("isToday and parseDate", () => {
        expect(isToday(new Date())).toBe(true);
        expect(isToday("2020-01-01")).toBe(false);
        expect(isToday(null)).toBe(false);
        expect(parseDate("2026-09-03")).toBeInstanceOf(Date);
        const dmy = parseDate("31.12.2026");
        expect([dmy.getFullYear(), dmy.getMonth(), dmy.getDate()]).toEqual([2026, 11, 31]);
        expect(parseDate("")).toBeNull();
        expect(parseDate("nunca")).toBeNull();
    });
});

describe("validation", () => {
    test("emails, phones and lengths", () => {
        expect(isValidEmail("ana@sena.edu.co")).toBe(true);
        expect(isValidEmail("ana@sena")).toBe(false);
        expect(isValidEmail("ana sena@x.co")).toBe(false);
        expect(isValidEmail("")).toBe(false);
        expect(isValidPhone("+57 (300) 123-4567")).toBe(true);
        expect(isValidPhone("300123")).toBe(false);
        expect(isValidPhone("300-abc-4567")).toBe(false);
        expect(isValidPhone(null)).toBe(false);
        expect(normalizePhone("+57 300 123 4567 ext 99999")).toBe("573001234567999");
        expect(normalizePhone(undefined)).toBe("");
        expect(maxLength("hola", 4)).toBe(true);
        expect(maxLength("hola!", 4)).toBe(false);
        expect(maxLength("", 1)).toBe(true);
        expect(isValidDate("2026-09-03")).toBe(true);
        expect(isValidDate("nunca")).toBe(false);
        expect(isValidDate("")).toBe(false);
    });

    test("birth dates follow the same rules as identity", () => {
        const today = new Date(2026, 9, 28);
        expect(birthDateError("", today)).toBeNull();
        expect(birthDateError("2000-02-29", today)).toBeNull();
        expect(birthDateError("2001-02-29", today)).toMatch(/no es válida/); // no existe
        expect(birthDateError("2000-2-1", today)).toMatch(/incompleta/);
        expect(birthDateError("1899-12-31", today)).toMatch(/1900/);
        expect(birthDateError("2026-10-29", today)).toMatch(/futura/);
        expect(birthDateError("2026-10-28", today)).toBeNull(); // hoy sí
    });

    test("validate collects every failing rule message", () => {
        const rules = [
            { fn: (v) => !!v, message: "requerido" },
            { fn: isValidEmail, message: "correo" },
        ];
        expect(validate("", rules)).toEqual({ isValid: false, errors: ["requerido", "correo"] });
        expect(validate("ana@x.co", rules)).toEqual({ isValid: true, errors: [] });
    });
});

describe("formatting", () => {
    test("numbers and percentages", () => {
        expect(formatNumber(1234567)).toMatch(/1.234.567/);
        expect(formatNumber(2.5, 1)).toMatch(/2.5/);
        expect(formatNumber(null)).toBe("0");
        expect(formatNumber("x")).toBe("0");
        expect(formatPercentage(0.8523)).toBe("85.23%");
        expect(formatPercentage(0.5, 0)).toBe("50%");
        expect(formatPercentage(undefined)).toBe("0%");
    });

    test("text helpers", () => {
        expect(titleCase("josé maría lópez")).toBe("José María López");
        expect(titleCase("")).toBe("");
        expect(normalizeText("Niño con tílde")).toBe("Nino con tilde");
        expect(normalizeText(null)).toBe("");
        expect(slugify("  Sede Norte — Ñandú!  ")).toBe("sede-norte-nandu");
        expect(slugify("")).toBe("");
        expect(trimDashes("--a-b--")).toBe("a-b");
        expect(trimDashes("----")).toBe("");
    });
});

describe("password rules", () => {
    test("a strong password passes and each missing rule is reported", () => {
        expect(validatePassword("Zeta#9xLw")).toEqual({ isValid: true, errors: [] });
        expect(validatePassword("").errors).toEqual(["La contraseña es requerida"]);
        expect(validatePassword("abc").errors).toEqual([
            "Debe tener al menos 8 caracteres",
            "Debe contener al menos 1 mayúscula",
            "Debe contener al menos 1 número",
            "Debe contener al menos 1 carácter especial",
        ]);
    });

    test("common words, keyboard runs, sequences and the user's own data are rejected", () => {
        expect(validatePassword("password").errors).toContain("Esta contraseña es muy común y predecible");
        expect(validatePassword("Qwerty#99x").errors).toContain("No uses patrones de teclado (qwerty, asdf, etc)");
        expect(validatePassword("Ab#123456").errors).toContain("No uses secuencias consecutivas (123456, abcdef)");
        expect(validatePassword("Xana#2026", { username: "ana" }).errors).toContain("No uses tu nombre de usuario en la contraseña");
        expect(validatePassword("Perez#2026x", { email: "ana.perez@sena.edu.co" }).errors).toContain("No uses parte de tu correo en la contraseña");
        // Un usuario de menos de 3 letras no se busca.
        expect(validatePassword("Zeta#9xLw", { username: "ze" }).isValid).toBe(true);
    });

    test("strength score, level and suggestions", () => {
        expect(getPasswordStrength("")).toBe(0);
        expect(getPasswordStrength("abc")).toBe(10);
        expect(getPasswordStrength("Zeta#9xLw")).toBe(60);
        expect(getPasswordStrength("Zeta#9xLw-Qp7&Mn4!")).toBe(100);
        expect(getPasswordStrengthLevel(10).level).toBe("Débil");
        expect(getPasswordStrengthLevel(60).level).toBe("Media");
        expect(getPasswordStrengthLevel(80).level).toBe("Fuerte");
        expect(getPasswordStrengthLevel(95).level).toBe("Muy fuerte");
        expect(getPasswordSuggestions("")).toEqual(["Ingresa una contraseña"]);
        expect(getPasswordSuggestions("ABC")).toEqual([
            "Añade más caracteres (mínimo 8)", "Añade letras minúsculas", "Añade números", "Añade caracteres especiales (!@#$%^&*)",
        ]);
        expect(getPasswordSuggestions("Zeta#9xLw")).toEqual(["¡Contraseña segura!"]);
    });
});

describe("student academic period", () => {
    const START = "2026-01-01";
    const END = "2027-12-31";

    test("a learner in the middle of a two-year program is in the right semester", () => {
        const p = calculateStudentCurrentPeriod(START, END, "semestral", new Date(2026, 8, 15));
        expect(p).toMatchObject({ status: "active", periodNumber: 2, totalPeriods: 4, isLastPeriod: false, label: "2do semestre", shortLabel: "2do" });
    });

    test("the last period is labelled as such", () => {
        const p = calculateStudentCurrentPeriod(START, END, "semestral", new Date(2027, 10, 1));
        expect(p).toMatchObject({ periodNumber: 4, isLastPeriod: true, label: "Último semestre", shortLabel: "Último" });
    });

    test("on the first day of the program the learner is in the first period, not in period 0", () => {
        const p = calculateStudentCurrentPeriod(START, END, "trimestral", new Date(START));
        expect(p.periodNumber).toBe(1);
        expect(p.label).toBe("1er trimestre");
    });

    test("before, after and with invalid dates", () => {
        expect(calculateStudentCurrentPeriod(START, END, "anual", new Date(2025, 0, 1)).status).toBe("not-started");
        expect(calculateStudentCurrentPeriod(START, END, "anual", new Date(2028, 0, 2)).status).toBe("finished");
        expect(calculateStudentCurrentPeriod("x", END, "anual").label).toBe("—");
    });

    test("the period is found from the learner's course by name, code or id", () => {
        const courses = [{ id: "7", code: "ADSO", name: "Análisis", startDate: START, endDate: END }];
        const when = new Date(2026, 8, 15);
        expect(getStudentPeriodFromData({ course: "ADSO" }, courses, "semestral", when).periodNumber).toBe(2);
        expect(getStudentPeriodFromData({ courseId: "7" }, courses, "semestral", when).periodNumber).toBe(2);
        expect(getStudentPeriodFromData({ course: "otro", grade: "3er" }, courses, "semestral", when)).toMatchObject({ label: "3er", error: expect.any(String) });
    });
});
