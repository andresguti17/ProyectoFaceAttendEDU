package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.application.usecase.DeleteAttendanceRecordUseCaseImpl;
import com.faceattend_edu.attendance_service.application.usecase.GetSupportingDocumentContentUseCaseImpl;
import com.faceattend_edu.attendance_service.application.usecase.ListSupportingDocumentsUseCaseImpl;
import com.faceattend_edu.attendance_service.application.usecase.UpdateAttendanceRecordUseCaseImpl;
import com.faceattend_edu.attendance_service.application.usecase.UpdateJustificationTypeUseCaseImpl;
import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordSlice;
import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.GetAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListAttendanceRecordsUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListJustificationsUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListSupportingDocumentsUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import com.faceattend_edu.attendance_service.domain.port.out.DocumentStoragePort;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.CreateAttendanceRecordRequest;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.UpdateAttendanceRecordRequest;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.AttendanceRecordWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.JustificationWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.SupportingDocumentWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.security.ActorScope;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Attendance relations, use cases and event publishing")
class AttendanceRelationsAndUseCasesTest {

    @AfterEach
    void clearScope() {
        RequestContextHolder.resetRequestAttributes();
    }

    private static void scope(Set<Long> actors) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (actors != null) request.setAttribute(ActorScope.ATTRIBUTE, actors);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    private static AttendanceRecord record(long id, long actor) {
        AttendanceRecord r = new AttendanceRecord();
        r.setAttendanceRecordId(id);
        r.setClassSessionId(9L);
        r.setAcademicActorId(actor);
        r.setAttendanceStatus("Absent");
        r.setCaptureMethod("MANUAL");
        return r;
    }

    @Nested
    class Relations {
        private final ListAttendanceRecordsUseCase records = mock(ListAttendanceRecordsUseCase.class);
        private final GetAttendanceRecordUseCase getRecord = mock(GetAttendanceRecordUseCase.class);
        private final ListJustificationsUseCase justifications = mock(ListJustificationsUseCase.class);
        private final GetJustificationUseCase getJustification = mock(GetJustificationUseCase.class);
        private final ListSupportingDocumentsUseCase documents = mock(ListSupportingDocumentsUseCase.class);
        private final AttendanceRelationsController controller = new AttendanceRelationsController(records, getRecord, justifications,
                getJustification, documents, new AttendanceRecordWebMapper(), new JustificationWebMapper(), new SupportingDocumentWebMapper());

        private Justification justification() {
            Justification j = new Justification();
            j.setJustificationId(5L);
            j.setAttendanceRecordId(1L);
            j.setReason("Cita médica");
            return j;
        }

        @Test
        void sessionAttendanceIsSearchedWithTheCallerScope() {
            scope(Set.of(7L));
            when(records.search(any(), eq(0), eq(null))).thenReturn(new AttendanceRecordSlice(List.of(record(1, 7)), 1));
            assertThat(controller.bySession(9L).getBody()).extracting("attendanceRecordId").containsExactly(1L);
            org.mockito.ArgumentCaptor<AttendanceRecordFilter> filter = org.mockito.ArgumentCaptor.forClass(AttendanceRecordFilter.class);
            verify(records).search(filter.capture(), eq(0), eq(null));
            assertThat(filter.getValue().actorScope()).containsExactly(7L);
        }

        @Test
        void anActorOutsideTheScopeIsForbidden() {
            scope(Set.of(7L));
            assertThatThrownBy(() -> controller.byActor(8L)).isInstanceOf(ActorScope.ScopeForbiddenException.class);
            when(records.search(any(), anyInt(), any())).thenReturn(new AttendanceRecordSlice(List.of(record(1, 7)), 1));
            assertThat(controller.byActor(7L).getBody()).hasSize(1);
        }

        @Test
        void aJustificationOrItsDocumentsAreVisibleOnlyInsideTheScope() {
            when(getRecord.getById(1L)).thenReturn(record(1, 7));
            when(getRecord.getById(2L)).thenThrow(new EntityNotFoundException("AttendanceRecord", 2L));
            when(justifications.search(any(), eq(0), eq(1)))
                    .thenReturn(new com.faceattend_edu.attendance_service.domain.model.JustificationSlice(List.of(), 0));
            when(justifications.search(org.mockito.ArgumentMatchers.argThat(f -> f != null && Long.valueOf(1L).equals(f.attendanceRecordId())), eq(0), eq(1)))
                    .thenReturn(new com.faceattend_edu.attendance_service.domain.model.JustificationSlice(List.of(justification()), 1));
            when(getJustification.getById(5L)).thenReturn(justification());
            SupportingDocument doc = new SupportingDocument();
            doc.setSupportingDocumentId(3L);
            doc.setJustificationId(5L);
            when(documents.listByJustificationId(5L)).thenReturn(List.of(doc));

            scope(Set.of(7L));
            assertThat(controller.byAttendance(1L).getBody().getReason()).isEqualTo("Cita médica");
            assertThat(controller.documentsByJustification(5L).getBody()).hasSize(1);
            assertThatThrownBy(() -> controller.byAttendance(2L)).isInstanceOf(ActorScope.ScopeForbiddenException.class);

            scope(Set.of(8L));
            assertThatThrownBy(() -> controller.byAttendance(1L)).isInstanceOf(ActorScope.ScopeForbiddenException.class);
            assertThatThrownBy(() -> controller.documentsByJustification(5L)).isInstanceOf(ActorScope.ScopeForbiddenException.class);
            when(getJustification.getById(99L)).thenThrow(new EntityNotFoundException("Justification", 99L));
            assertThatThrownBy(() -> controller.documentsByJustification(99L)).isInstanceOf(EntityNotFoundException.class);

            scope(null);
            assertThat(controller.byAttendance(2L).getBody()).isNull();
            verify(getRecord, org.mockito.Mockito.times(1)).getById(2L); // only the restricted call above looked it up
        }
    }

    @Nested
    class WebMapper {
        @Test
        void mapsRequestsAndResponses() {
            AttendanceRecordWebMapper mapper = new AttendanceRecordWebMapper();
            CreateAttendanceRecordRequest create = new CreateAttendanceRecordRequest();
            create.setClassSessionId(9L);
            create.setAcademicActorId(7L);
            create.setAttendanceStatus("Present");
            create.setCaptureMethod("FACIAL");
            create.setMatchScore(new BigDecimal("0.93"));
            assertThat(mapper.toDomain(create)).extracting("academicActorId", "captureMethod").containsExactly(7L, "FACIAL");

            UpdateAttendanceRecordRequest update = new UpdateAttendanceRecordRequest();
            update.setAttendanceStatus("Late");
            update.setCapturedAt(Instant.parse("2026-10-05T07:10:00Z"));
            assertThat(mapper.toDomain(update).getAttendanceStatus()).isEqualTo("Late");

            AttendanceRecord stored = record(1, 7);
            stored.setRowVersion(3);
            assertThat(mapper.toResponse(stored)).extracting("attendanceRecordId", "rowVersion").containsExactly(1L, 3L);
            assertThat(mapper.toResponse(null)).isNull();
            assertThat(mapper.toDomain((CreateAttendanceRecordRequest) null)).isNull();
            assertThat(mapper.toDomain((UpdateAttendanceRecordRequest) null)).isNull();
        }
    }

    @Nested
    class UseCases {
        @Test
        void updatingARecordMergesAndValidatesTheChanges() {
            AttendanceRecordRepository repository = mock(AttendanceRecordRepository.class);
            when(repository.findById(1L)).thenReturn(Optional.of(record(1, 7)));
            when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            AttendanceRecord patch = new AttendanceRecord();
            patch.setAttendanceStatus("Justified");
            patch.setCaptureMethod("FINGERPRINT");
            patch.setMatchScore(new BigDecimal("0.8"));
            patch.setCapturedAt(Instant.parse("2026-10-05T07:00:00Z"));
            AttendanceRecord updated = new UpdateAttendanceRecordUseCaseImpl(repository).update(1L, patch);
            assertThat(updated.getAttendanceStatus()).isEqualTo("Justified");
            assertThat(updated.getCaptureMethod()).isEqualTo("FINGERPRINT");

            AttendanceRecord invalid = new AttendanceRecord();
            invalid.setMatchScore(new BigDecimal("1.5"));
            assertThatThrownBy(() -> new UpdateAttendanceRecordUseCaseImpl(repository).update(1L, invalid))
                    .hasMessage("matchScore must be between 0 and 1");
            assertThatThrownBy(() -> new UpdateAttendanceRecordUseCaseImpl(repository).update(2L, patch)).isInstanceOf(EntityNotFoundException.class);

            when(repository.existsById(1L)).thenReturn(true);
            new DeleteAttendanceRecordUseCaseImpl(repository).delete(1L);
            verify(repository).deleteById(1L);
            assertThatThrownBy(() -> new DeleteAttendanceRecordUseCaseImpl(repository).delete(2L)).isInstanceOf(EntityNotFoundException.class);
        }

        @Test
        void updatingAJustificationTypeKeepsDefaultsAndLimits() {
            JustificationTypeRepository repository = mock(JustificationTypeRepository.class);
            JustificationType stored = new JustificationType();
            stored.setName("Médica");
            when(repository.findById(1)).thenReturn(Optional.of(stored));
            when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            JustificationType patch = new JustificationType();
            patch.setDescription("Con soporte médico");
            patch.setSchoolId(2);
            JustificationType updated = new UpdateJustificationTypeUseCaseImpl(repository).update(1, patch);
            assertThat(updated.getRequiresAttachment()).isFalse();
            assertThat(updated.getStatus()).isTrue();
            assertThat(updated.getSchoolId()).isEqualTo(2);

            JustificationType tooLong = new JustificationType();
            tooLong.setName("x".repeat(256));
            assertThatThrownBy(() -> new UpdateJustificationTypeUseCaseImpl(repository).update(1, tooLong)).hasMessage("name max 255");
            JustificationType all = new JustificationType();
            all.setName("Calamidad");
            all.setRequiresAttachment(true);
            all.setStatus(false);
            assertThat(new UpdateJustificationTypeUseCaseImpl(repository).update(1, all).getRequiresAttachment()).isTrue();
            assertThatThrownBy(() -> new UpdateJustificationTypeUseCaseImpl(repository).update(9, patch)).isInstanceOf(EntityNotFoundException.class);
        }

        @Test
        void documentContentComesFromStorageAndALegacyRowWithoutObjectIs404() {
            GetSupportingDocumentUseCase documents = mock(GetSupportingDocumentUseCase.class);
            DocumentStoragePort storage = mock(DocumentStoragePort.class);
            SupportingDocument doc = new SupportingDocument();
            doc.setStorageUri("justification-documents/2026/10/a.pdf");
            when(documents.getById(3L)).thenReturn(doc);
            when(storage.get("justification-documents/2026/10/a.pdf")).thenReturn(Optional.of(new byte[] {1, 2}));
            assertThat(new GetSupportingDocumentContentUseCaseImpl(documents, storage).getContent(3L).bytes()).containsExactly(1, 2);

            when(storage.get(anyString())).thenReturn(Optional.empty());
            assertThatThrownBy(() -> new GetSupportingDocumentContentUseCaseImpl(documents, storage).getContent(3L))
                    .isInstanceOf(EntityNotFoundException.class);

            SupportingDocumentRepository repository = mock(SupportingDocumentRepository.class);
            when(repository.findByJustificationId(5L)).thenReturn(List.of());
            assertThat(new ListSupportingDocumentsUseCaseImpl(repository).listByJustificationId(5L)).isEmpty();
        }
    }

    @Nested
    @SuppressWarnings("unchecked")
    class Events {
        private final KafkaTemplate<String, String> kafka = mock(KafkaTemplate.class);
        private final DomainEventPublisher publisher = new DomainEventPublisher(kafka);

        @AfterEach
        void clearSync() {
            if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
        }

        @Test
        void withoutATransactionTheEventGoesOutAtOnce() {
            publisher.publishAfterCommit("attendance-events", "k", "{}");
            verify(kafka).send("attendance-events", "k", "{}");
        }

        @Test
        void insideATransactionTheEventWaitsForTheCommit() {
            TransactionSynchronizationManager.initSynchronization();
            publisher.publishAfterCommit("attendance-events", "k", "{}");
            verify(kafka, never()).send(anyString(), anyString(), anyString());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) sync.afterCommit();
            verify(kafka).send("attendance-events", "k", "{}");
        }

        @Test
        void aKafkaFailureNeverBreaksTheRequest() {
            when(kafka.send(anyString(), anyString(), anyString())).thenThrow(new IllegalStateException("broker down"));
            when(kafka.send(anyString(), anyString())).thenThrow(new IllegalStateException("broker down"));
            publisher.publishAfterCommit("t", "k", "{}");
            publisher.publish("t", "{}");
            verify(kafka).send("t", "{}");
        }
    }
}
