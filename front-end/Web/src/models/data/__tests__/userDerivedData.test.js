// Aprendices en riesgo, destacados e instructores: las cifras salen del resumen real de asistencia.
import { getAttendanceThresholds, getAtRiskStudents, getPerfectAttendanceStudents, getInstructorAttendance, getAllDerivedUserData } from "../userDerivedData";
import { saveInstitutionConfig, getDefaultInstitutionConfig } from "../../../core/config/institutionConfig";

const counts = (present, late, absent, justified = 0) => ({ present, late, absent, justified, total: present + late + absent + justified });
const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

beforeEach(() => {
    saveInstitutionConfig({ ...getDefaultInstitutionConfig(), minAttendance: 80, daysUntilSanction: 10, consecutiveDaysForSanction: 3 });
});

test("thresholds follow the configured minimum", () => {
    expect(getAttendanceThresholds()).toMatchObject({ minAttendance: 80, excellent: 80, warning: 70, danger: 70, consecutiveDaysForSanction: 3 });
});

describe("learners at risk", () => {
    test("absences and lates are the real counts, not estimates over 45 classes", () => {
        const [risk] = getAtRiskStudents([
            { id: "1", name: "Ana", status: "active", attendance: 60, attendanceCounts: counts(5, 1, 4) },
        ], 80);

        expect(risk).toMatchObject({ studentId: "1", totalAbsences: 4, lateCount: 1, riskLevel: "high" });
    });

    test("only active learners below the minimum, or with too many consecutive absences, are listed", () => {
        const list = getAtRiskStudents([
            { id: "ok", status: "active", attendance: 95, attendanceCounts: counts(19, 0, 1) },
            { id: "low", status: "active", attendance: 75, attendanceCounts: counts(15, 0, 5) },
            { id: "inactive", status: "inactive", attendance: 10 },
            {
                id: "streak", status: "active", attendance: 90,
                attendanceHistory: [{ present: true }, { present: false }, { present: false }, { present: false }],
            },
        ], 80);

        expect(list.map((s) => s.studentId).sort()).toEqual(["low", "streak"]);
        const streak = list.find((s) => s.studentId === "streak");
        expect(streak).toMatchObject({ consecutiveAbsences: 3, hasExceededConsecutiveDays: true, riskLevel: "high" });
    });

    test("days since the last attendance count down to the sanction only with an absence signal", () => {
        const [low] = getAtRiskStudents([{ id: "1", status: "active", attendance: 75, lastAttendanceDate: daysAgo(4) }], 80);
        // 75 % está sobre la alerta (70 %) y quedan 6 días, más de la mitad de 10: riesgo bajo.
        expect(low).toMatchObject({ daysUntilSanction: 6, lastAttendance: "Hace 4 días", riskLevel: "low" });
        const [near] = getAtRiskStudents([{ id: "4", status: "active", attendance: 75, lastAttendanceDate: daysAgo(6) }], 80);
        expect(near).toMatchObject({ daysUntilSanction: 4, riskLevel: "high" });
        const [medium] = getAtRiskStudents([{ id: "5", status: "active", attendance: 65, lastAttendanceDate: daysAgo(0) }], 80);
        expect(medium.riskLevel).toBe("high"); // bajo el umbral de peligro (70 %)

        const [today] = getAtRiskStudents([{ id: "2", status: "active", attendance: 75, lastAttendanceDate: daysAgo(0) }], 80);
        expect(today.lastAttendance).toBe("Hoy");

        // Cumple el mínimo y no tiene faltas: unos días sin clase no lo acercan a la sanción.
        expect(getAtRiskStudents([{ id: "3", status: "active", attendance: 90, lastAttendanceDate: daysAgo(30) }], 80)).toEqual([]);
    });

    test("without a summary the old estimate is still used", () => {
        const [risk] = getAtRiskStudents([{ id: "1", status: "active", attendance: 60 }], 80);
        expect(risk.totalAbsences).toBe(18); // 40 % de 45
        expect(risk.lateCount).toBe(3);
    });

    test("an empty list stays empty", () => {
        expect(getAtRiskStudents([], 80)).toEqual([]);
        expect(getAtRiskStudents(null)).toEqual([]);
    });
});

describe("outstanding learners", () => {
    test("show attended over registered classes from the real summary", () => {
        const list = getPerfectAttendanceStudents([
            { id: "1", name: "Ana", status: "active", attendance: 97, attendanceCounts: counts(30, 1, 1) },
            { id: "2", name: "Luis", status: "active", attendance: 99 },
            { id: "3", name: "Eva", status: "active", attendance: 80 },
            { id: "4", status: "inactive", attendance: 100 },
        ], 80);

        expect(list.map((s) => s.studentId)).toEqual(["2", "1"]);
        expect(list.find((s) => s.studentId === "1")).toMatchObject({ totalClasses: 32, streak: "31/32 clases" });
        expect(list.find((s) => s.studentId === "2")).toMatchObject({ totalClasses: null, streak: "99%" });
        expect(list[0]).not.toHaveProperty("consecutivePerfect");
    });
});

describe("instructors", () => {
    test("rate is taught over scheduled classes; no sessions means no data, not 100 %", () => {
        const list = getInstructorAttendance(
            [{ id: "t1", actorId: 1, name: "Iván" }, { id: "t2", actorId: 2, name: "Sara" }, { id: "t3", actorId: 3, name: "Nadie" }],
            new Map([["1", { scheduled: 10, taught: 9 }], ["2", { scheduled: 10, taught: 6 }]])
        );

        expect(list.map((i) => [i.instructorName, i.attendanceRate, i.status, i.missedClasses])).toEqual([
            ["Iván", 90, "excellent", 1],
            ["Sara", 60, "warning", 4],
            ["Nadie", 0, "nodata", 0],
        ]);
        expect(getInstructorAttendance([])).toEqual([]);
    });

    test("all derived data together", () => {
        const all = getAllDerivedUserData([{ id: "1", status: "active", attendance: 50 }], []);
        expect(all.atRiskStudents).toHaveLength(1);
        expect(all.thresholds.minAttendance).toBe(80);
    });
});
