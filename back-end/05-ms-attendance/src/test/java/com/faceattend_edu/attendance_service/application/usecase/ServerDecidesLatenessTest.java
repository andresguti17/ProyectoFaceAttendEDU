package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.PeerUnavailableException;
import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.ArrivalWindow;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.out.ArrivalWindowPort;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * N-14: the kiosk used to compare its own clock with the tolerance and send Late or Present, and the
 * server stored whatever it received. Now the server ignores the client's arrival status and decides it.
 */
@ExtendWith(MockitoExtension.class)
class ServerDecidesLatenessTest {

    private static final long SESSION = 10L;
    private static final long ACTOR = 20L;
    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

    @Mock AttendanceRecordRepository repository;
    @Mock DomainEventPublisher eventPublisher;
    @Mock ArrivalWindowPort arrivalWindows;

    private CreateAttendanceRecordUseCaseImpl create;
    private RecordAttendanceUseCaseImpl record;

    @BeforeEach
    void setUp() {
        create = new CreateAttendanceRecordUseCaseImpl(repository, eventPublisher, arrivalWindows);
        record = new RecordAttendanceUseCaseImpl(repository, arrivalWindows);
        lenient().when(repository.findByClassSessionIdAndAcademicActorId(SESSION, ACTOR)).thenReturn(Optional.empty());
        lenient().when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private void classStartedMinutesAgo(long minutes) {
        when(arrivalWindows.windowFor(SESSION))
                .thenReturn(new ArrivalWindow(LocalDateTime.now(BOGOTA).minusMinutes(minutes), 15, BOGOTA));
    }

    private static AttendanceRecord request(String status) {
        AttendanceRecord r = new AttendanceRecord();
        r.setClassSessionId(SESSION);
        r.setAcademicActorId(ACTOR);
        r.setAttendanceStatus(status);
        r.setCaptureMethod("FACIAL");
        return r;
    }

    @Test
    void aClientClaimingPresentAfterTheToleranceIsRecordedLate() {
        classStartedMinutesAgo(40);

        assertEquals("Late", create.create(request("Present")).getAttendanceStatus());
    }

    @Test
    void aClientClaimingLateWithinTheToleranceIsRecordedPresent() {
        classStartedMinutesAgo(5);

        assertEquals("Present", create.create(request("Late")).getAttendanceStatus());
    }

    @Test
    void theCaptureTimeIsTheServerClock() {
        classStartedMinutesAgo(5);
        Instant before = Instant.now();

        AttendanceRecord saved = create.create(request("Present"));

        assertTrue(!saved.getCapturedAt().isBefore(before) && saved.getCapturedAt().isBefore(before.plus(1, ChronoUnit.MINUTES)));
    }

    @Test
    void anAbsenceIsKeptAsSentAndNeedsNoSchedule() {
        AttendanceRecord saved = record.record(SESSION, ACTOR, "Absent", "MANUAL", null);

        assertEquals("Absent", saved.getAttendanceStatus());
        assertNull(saved.getCapturedAt());
        verifyNoInteractions(arrivalWindows);
    }

    @Test
    void aJustifiedRecordIsKeptAsSent() {
        assertEquals("Justified", create.create(request("Justified")).getAttendanceStatus());
        verifyNoInteractions(arrivalWindows);
    }

    @Test
    void bulkAndSingleRecordingApplyTheSameRule() {
        classStartedMinutesAgo(40);

        assertEquals("Late", record.record(SESSION, ACTOR, "Present", "FINGERPRINT", null).getAttendanceStatus());
    }

    @Test
    void anUnknownSessionIsRejectedAndNothingIsSaved() {
        when(arrivalWindows.windowFor(SESSION)).thenThrow(new ValidationException("classSessionId 10 does not exist"));

        assertThrows(ValidationException.class, () -> create.create(request("Present")));
        verify(repository, never()).save(any());
        verify(eventPublisher, never()).publish(anyString(), anyString());
    }

    @Test
    void whenSchedulingIsDownTheRecordIsNotSavedWithAGuessedStatus() {
        when(arrivalWindows.windowFor(SESSION)).thenThrow(new PeerUnavailableException("scheduling down", null));

        assertThrows(PeerUnavailableException.class, () -> record.record(SESSION, ACTOR, "Present", "FACIAL", null));
        verify(repository, never()).save(any());
    }

    @Test
    void aDuplicateIsRejectedBeforeAskingForTheSchedule() {
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, ACTOR)).thenReturn(Optional.of(request("Present")));

        assertThrows(RuntimeException.class, () -> create.create(request("Present")));
        verifyNoInteractions(arrivalWindows);
    }
}
