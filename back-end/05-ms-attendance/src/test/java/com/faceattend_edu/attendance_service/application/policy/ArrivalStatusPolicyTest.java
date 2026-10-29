package com.faceattend_edu.attendance_service.application.policy;

import com.faceattend_edu.attendance_service.application.usecase.CreateAttendanceRecordUseCaseImpl;
import com.faceattend_edu.attendance_service.application.usecase.RecordAttendanceUseCaseImpl;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.out.ArrivalTimingPort;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** N-14: Present or Late for a biometric arrival comes from the server clock, not from the kiosk. */
class ArrivalStatusPolicyTest {

    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");
    private static final LocalDate DAY = LocalDate.of(2026, 10, 21);
    // Block starts 07:00 with 15 minutes of tolerance.
    private static final ArrivalTimingPort.Timing SEVEN_AM = new ArrivalTimingPort.Timing(DAY, LocalTime.of(7, 0), 15);

    private static Instant at(int hour, int minute, int second) {
        return DAY.atTime(hour, minute, second).atZone(BOGOTA).toInstant();
    }

    private static ArrivalStatusPolicy policy(Optional<ArrivalTimingPort.Timing> timing) {
        return new ArrivalStatusPolicy((session, actor) -> timing, "America/Bogota");
    }

    @Test
    void anArrivalWithinTheToleranceIsPresentEvenIfTheKioskSaidLate() {
        assertEquals("Present", policy(Optional.of(SEVEN_AM)).resolve(1L, 2L, "Late", "FACIAL", at(7, 10, 0)));
    }

    @Test
    void anArrivalPastTheToleranceIsLateEvenIfTheKioskSaidPresent() {
        assertEquals("Late", policy(Optional.of(SEVEN_AM)).resolve(1L, 2L, "Present", "FINGERPRINT", at(7, 16, 0)));
    }

    @Test
    void theLimitMinuteIsStillPresentAndSecondsDoNotCount() {
        ArrivalStatusPolicy policy = policy(Optional.of(SEVEN_AM));
        assertEquals("Present", policy.resolve(1L, 2L, "Present", "FACIAL", at(7, 15, 59)));
        assertEquals("Late", policy.resolve(1L, 2L, "Present", "FACIAL", at(7, 16, 0)));
    }

    @Test
    void anArrivalBeforeTheBlockStartsIsPresent() {
        assertEquals("Present", policy(Optional.of(SEVEN_AM)).resolve(1L, 2L, "Late", "FACIAL", at(6, 30, 0)));
    }

    @Test
    void anArrivalOnALaterDayIsLate() {
        Instant nextDay = DAY.plusDays(1).atTime(7, 0).atZone(BOGOTA).toInstant();
        assertEquals("Late", policy(Optional.of(SEVEN_AM)).resolve(1L, 2L, "Present", "FACIAL", nextDay));
    }

    @Test
    void theSchoolZoneDecidesWhatTimeItIs() {
        // 12:20 UTC is 07:20 in Bogota (UTC-5): late. Read as UTC it would be five hours late anyway, so
        // check the other direction too: 11:55 UTC is 06:55 in Bogota, before the start.
        ArrivalStatusPolicy policy = policy(Optional.of(SEVEN_AM));
        assertEquals("Late", policy.resolve(1L, 2L, "Present", "FACIAL", DAY.atTime(12, 20).atZone(ZoneId.of("UTC")).toInstant()));
        assertEquals("Present", policy.resolve(1L, 2L, "Late", "FACIAL", DAY.atTime(11, 55).atZone(ZoneId.of("UTC")).toInstant()));
    }

    @Test
    void manualAndImportedRecordsKeepTheStatusTheInstructorChose() {
        ArrivalStatusPolicy policy = policy(Optional.of(SEVEN_AM));
        assertEquals("Present", policy.resolve(1L, 2L, "Present", "MANUAL", at(9, 0, 0)));
        assertEquals("Late", policy.resolve(1L, 2L, "Late", "IMPORT", at(7, 1, 0)));
    }

    @Test
    void statusesOtherThanPresentOrLateAreNeverRewritten() {
        ArrivalStatusPolicy policy = policy(Optional.of(SEVEN_AM));
        assertEquals("Absent", policy.resolve(1L, 2L, "Absent", "FACIAL", at(9, 0, 0)));
        assertEquals("Justified", policy.resolve(1L, 2L, "Justified", "FACIAL", at(9, 0, 0)));
    }

    @Test
    void withoutTimingDataTheClientStatusIsKept() {
        assertEquals("Late", policy(Optional.empty()).resolve(1L, 2L, "Late", "FACIAL", at(7, 1, 0)));
        assertEquals("Present", policy(Optional.empty()).resolve(1L, 2L, "Present", "FACIAL", at(9, 0, 0)));
    }

    @Test
    void aMissingCaptureTimeFallsBackToNow() {
        ArrivalTimingPort.Timing longAgo = new ArrivalTimingPort.Timing(LocalDate.of(2020, 1, 1), LocalTime.of(7, 0), 15);
        assertEquals("Late", policy(Optional.of(longAgo)).resolve(1L, 2L, "Present", "FACIAL", null));
    }

    @Test
    void createRewritesTheStatusBeforeSaving() {
        AttendanceRecordRepository repository = mock(AttendanceRecordRepository.class);
        when(repository.findByClassSessionIdAndAcademicActorId(any(), any())).thenReturn(Optional.empty());
        when(repository.save(any(AttendanceRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
        // Timing in 2020: whatever time the test runs, the arrival is long past the tolerance.
        ArrivalStatusPolicy lateAlways = policy(Optional.of(new ArrivalTimingPort.Timing(LocalDate.of(2020, 1, 1), LocalTime.of(7, 0), 15)));
        CreateAttendanceRecordUseCaseImpl create = new CreateAttendanceRecordUseCaseImpl(repository, mock(DomainEventPublisher.class), lateAlways);

        AttendanceRecord row = new AttendanceRecord();
        row.setClassSessionId(10L);
        row.setAcademicActorId(20L);
        row.setAttendanceStatus("Present");
        row.setCaptureMethod("FACIAL");
        row.setMatchScore(new BigDecimal("0.93"));

        assertEquals("Late", create.create(row).getAttendanceStatus());
    }

    @Test
    void recordRewritesTheStatusBeforeSaving() {
        AttendanceRecordRepository repository = mock(AttendanceRecordRepository.class);
        when(repository.findByClassSessionIdAndAcademicActorId(any(), any())).thenReturn(Optional.empty());
        when(repository.save(any(AttendanceRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ArrivalStatusPolicy lateAlways = policy(Optional.of(new ArrivalTimingPort.Timing(LocalDate.of(2020, 1, 1), LocalTime.of(7, 0), 15)));
        RecordAttendanceUseCaseImpl record = new RecordAttendanceUseCaseImpl(repository, lateAlways);

        assertEquals("Late", record.record(10L, 20L, "Present", "FINGERPRINT", null).getAttendanceStatus());
        assertEquals("Present", record.record(11L, 21L, "Present", "MANUAL", null).getAttendanceStatus());
    }
}
