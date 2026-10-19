package com.faceattend_edu.attendance_service.domain.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AttendanceRecordTest {

    private AttendanceRecord record(String status, String method) {
        AttendanceRecord record = new AttendanceRecord();
        record.setClassSessionId(1L);
        record.setAcademicActorId(2L);
        record.setAttendanceStatus(status);
        record.setCaptureMethod(method);
        return record;
    }

    @ParameterizedTest
    @ValueSource(strings = {"Present", "Absent", "Late", "Justified"})
    void acceptsEveryAttendanceStatus(String status) {
        assertDoesNotThrow(record(status, "FACIAL")::validate);
    }

    @ParameterizedTest
    @ValueSource(strings = {"FACIAL", "MANUAL", "IOT", "IMPORT"})
    void acceptsEveryCaptureMethod(String method) {
        assertDoesNotThrow(record("Present", method)::validate);
    }

    @Test
    void rejectsAStatusOutsideTheEnum() {
        assertThrows(IllegalArgumentException.class, record("Excused", "FACIAL")::validate);
    }

    @Test
    void rejectsACaptureMethodOutsideTheEnum() {
        assertThrows(IllegalArgumentException.class, record("Present", "TELEPATHY")::validate);
    }

    @Test
    void requiresTheSessionAndTheActor() {
        AttendanceRecord noSession = record("Present", "FACIAL");
        noSession.setClassSessionId(null);
        AttendanceRecord noActor = record("Present", "FACIAL");
        noActor.setAcademicActorId(null);

        assertThrows(IllegalArgumentException.class, noSession::validate);
        assertThrows(IllegalArgumentException.class, noActor::validate);
    }

    @Test
    void matchScoreMustStayBetweenZeroAndOne() {
        AttendanceRecord low = record("Present", "FACIAL");
        low.setMatchScore(new BigDecimal("-0.0001"));
        AttendanceRecord high = record("Present", "FACIAL");
        high.setMatchScore(new BigDecimal("1.0001"));
        AttendanceRecord edge = record("Present", "FACIAL");
        edge.setMatchScore(BigDecimal.ONE);

        assertThrows(IllegalArgumentException.class, low::validate);
        assertThrows(IllegalArgumentException.class, high::validate);
        assertDoesNotThrow(edge::validate);
    }

    @Test
    void anAbsenceHasNoCaptureTime() {
        AttendanceRecord absent = record("Absent", "MANUAL");
        absent.touchCreated();

        assertNull(absent.getCapturedAt());
        assertEquals(1L, absent.getRowVersion());
    }

    @Test
    void aPresentRecordGetsACaptureTime() {
        AttendanceRecord present = record("Present", "FACIAL");
        present.touchCreated();

        assertNotNull(present.getCapturedAt());
    }
}
