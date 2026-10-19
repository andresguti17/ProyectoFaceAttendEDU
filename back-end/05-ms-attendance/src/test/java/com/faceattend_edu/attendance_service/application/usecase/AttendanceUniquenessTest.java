package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** One attendance record per (class_session_id, academic_actor_id), however it is created. */
@ExtendWith(MockitoExtension.class)
class AttendanceUniquenessTest {

    private static final long SESSION = 10L;
    private static final long ACTOR = 20L;

    @Mock AttendanceRecordRepository repository;
    @Mock DomainEventPublisher eventPublisher;

    private CreateAttendanceRecordUseCaseImpl create;
    private RecordAttendanceUseCaseImpl record;
    private BulkRecordAttendanceUseCaseImpl bulk;

    @BeforeEach
    void setUp() {
        create = new CreateAttendanceRecordUseCaseImpl(repository, eventPublisher);
        record = new RecordAttendanceUseCaseImpl(repository);
        bulk = new BulkRecordAttendanceUseCaseImpl(record);
    }

    private AttendanceRecord row(long session, long actor, String status) {
        AttendanceRecord row = new AttendanceRecord();
        row.setClassSessionId(session);
        row.setAcademicActorId(actor);
        row.setAttendanceStatus(status);
        row.setCaptureMethod("FACIAL");
        row.setMatchScore(new BigDecimal("0.93"));
        return row;
    }

    @Test
    void createRejectsASecondRecordForTheSameActorAndSession() {
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, ACTOR))
                .thenReturn(Optional.of(row(SESSION, ACTOR, "Present")));

        assertThrows(DuplicateEntityException.class, () -> create.create(row(SESSION, ACTOR, "Late")));
        verify(repository, never()).save(any());
        verify(eventPublisher, never()).publish(any(), any());
    }

    @Test
    void createMapsARaceOnTheUniqueConstraintToADuplicate() {
        AttendanceRecord input = row(SESSION, ACTOR, "Present");
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, ACTOR)).thenReturn(Optional.empty());
        when(repository.save(input)).thenThrow(new DataIntegrityViolationException("uq_attendance_session_actor"));

        assertThrows(DuplicateEntityException.class, () -> create.create(input));
    }

    @Test
    void createSavesAndPublishesWhenTheActorHasNoRecordYet() {
        AttendanceRecord input = row(SESSION, ACTOR, "Present");
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, ACTOR)).thenReturn(Optional.empty());
        when(repository.save(input)).thenReturn(input);

        create.create(input);

        verify(eventPublisher).publish(any(String.class), any(String.class));
    }

    @Test
    void recordRejectsADuplicateBeforeSaving() {
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, ACTOR))
                .thenReturn(Optional.of(row(SESSION, ACTOR, "Present")));

        assertThrows(DuplicateEntityException.class,
                () -> record.record(SESSION, ACTOR, "Present", "FACIAL", new BigDecimal("0.9")));
        verify(repository, never()).save(any());
    }

    @Test
    void anAbsenceIsRecordedWithoutACaptureTime() {
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, ACTOR)).thenReturn(Optional.empty());
        when(repository.save(any(AttendanceRecord.class))).thenAnswer(call -> call.getArgument(0));

        AttendanceRecord saved = record.record(SESSION, ACTOR, "Absent", "MANUAL", null);

        assertNull(saved.getCapturedAt());
    }

    @Test
    void aPresentRecordKeepsItsCaptureTime() {
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, ACTOR)).thenReturn(Optional.empty());
        when(repository.save(any(AttendanceRecord.class))).thenAnswer(call -> call.getArgument(0));

        AttendanceRecord saved = record.record(SESSION, ACTOR, "Present", "FACIAL", new BigDecimal("0.9"));

        assertNotNull(saved.getCapturedAt());
    }

    @Test
    void bulkSavesEveryRowOfAClass() {
        when(repository.findByClassSessionIdAndAcademicActorId(any(), any())).thenReturn(Optional.empty());
        when(repository.save(any(AttendanceRecord.class))).thenAnswer(call -> call.getArgument(0));

        List<AttendanceRecord> saved = bulk.bulk(List.of(
                row(SESSION, 1L, "Present"), row(SESSION, 2L, "Late"), row(SESSION, 3L, "Absent")));

        assertEquals(3, saved.size());
        assertEquals("Late", saved.get(1).getAttendanceStatus());
    }

    @Test
    void bulkStopsWithADuplicateWhenOneActorIsAlreadyRecorded() {
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, 1L)).thenReturn(Optional.empty());
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, 2L))
                .thenReturn(Optional.of(row(SESSION, 2L, "Present")));
        when(repository.save(any(AttendanceRecord.class))).thenAnswer(call -> call.getArgument(0));

        assertThrows(DuplicateEntityException.class,
                () -> bulk.bulk(List.of(row(SESSION, 1L, "Present"), row(SESSION, 2L, "Present"))));
    }
}
