package com.faceattend_edu.attendance_service.domain.model;

import com.faceattend_edu.attendance_service.domain.model.AttendanceReport.Row;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AttendanceReportTest {

    private final List<Row> rows = List.of(
            new Row(10L, 1L, "Present", 8),
            new Row(10L, 1L, "Late", 1),
            new Row(10L, 1L, "Absent", 1),
            new Row(10L, 2L, "Present", 5),
            new Row(10L, 2L, "Justified", 5),
            new Row(11L, 2L, "Absent", 2));

    @Test
    void totalsAddEveryStatus() {
        AttendanceReport report = AttendanceReport.from(rows);

        assertEquals(13, report.getTotals().getPresent());
        assertEquals(1, report.getTotals().getLate());
        assertEquals(3, report.getTotals().getAbsent());
        assertEquals(5, report.getTotals().getJustified());
        assertEquals(22, report.getTotals().getTotal());
    }

    @Test
    void rateIsPresentPlusLateOverTotal_aJustifiedAbsenceDoesNotCount() {
        AttendanceReport report = AttendanceReport.from(rows);

        assertEquals(63.6, report.getTotals().getAttendanceRate());
        assertEquals(90.0, report.getByActor().get(1L).getAttendanceRate());
        assertEquals(41.7, report.getByActor().get(2L).getAttendanceRate());
    }

    @Test
    void groupsByActorAndBySession() {
        AttendanceReport report = AttendanceReport.from(rows);

        assertEquals(2, report.getByActor().size());
        assertEquals(10, report.getByActor().get(1L).getTotal());
        assertEquals(2, report.getBySession().size());
        assertEquals(20, report.getBySession().get(10L).getTotal());
        assertEquals(2, report.getBySession().get(11L).getTotal());
    }

    @Test
    void anEmptyReportHasNoRate() {
        AttendanceReport report = AttendanceReport.from(List.of());

        assertEquals(0, report.getTotals().getTotal());
        assertNull(report.getTotals().getAttendanceRate());
    }

    @Test
    void csvHasATotalLineThenActorsThenSessions() {
        String csv = AttendanceReport.from(rows).toCsv();
        String[] lines = csv.split("\n");

        assertEquals("scope,id,present,late,absent,justified,total,attendanceRate", lines[0]);
        assertEquals("TOTAL,,13,1,3,5,22,63.6", lines[1]);
        assertTrue(csv.contains("ACTOR,1,8,1,1,0,10,90.0"));
        assertTrue(csv.contains("SESSION,11,0,0,2,0,2,0.0"));
        assertEquals(6, lines.length);
    }
}
