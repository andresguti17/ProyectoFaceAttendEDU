package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationRepository;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JustificationReviewTest {

    private static final long ID = 5L;
    private static final long RECORD = 9L;

    @Mock JustificationRepository repository;
    @Mock JustificationTypeRepository typeRepository;
    @Mock SupportingDocumentRepository documentRepository;
    @Mock AttendanceRecordRepository recordRepository;
    @Mock DomainEventPublisher eventPublisher;

    private CreateJustificationUseCaseImpl create;
    private ReviewJustificationUseCaseImpl review;

    @BeforeEach
    void setUp() {
        create = new CreateJustificationUseCaseImpl(repository, recordRepository, eventPublisher);
        review = new ReviewJustificationUseCaseImpl(repository, typeRepository, documentRepository, recordRepository, eventPublisher);
        lenient().when(repository.save(any(Justification.class))).thenAnswer(call -> call.getArgument(0));
        lenient().when(recordRepository.findById(RECORD)).thenReturn(Optional.of(record("Absent")));
    }

    private AttendanceRecord record(String status) {
        AttendanceRecord r = new AttendanceRecord();
        r.setAttendanceRecordId(RECORD);
        r.setAttendanceStatus(status);
        return r;
    }

    private Justification pending() {
        Justification j = new Justification();
        j.setJustificationId(ID);
        j.setAttendanceRecordId(RECORD);
        j.setJustificationTypeId(1);
        j.setReason("Medical appointment");
        j.setReviewStatus("Pending");
        return j;
    }

    @Test
    void aNewJustificationStartsPendingWithASubmissionTime() {
        Justification input = pending();
        input.setReviewStatus(null);
        input.setJustificationId(null);
        when(repository.findByAttendanceRecordId(RECORD)).thenReturn(Optional.empty());

        Justification saved = create.create(input);

        assertEquals("Pending", saved.getReviewStatus());
        assertNotNull(saved.getSubmittedAt());
    }

    @Test
    void onlyOneJustificationPerAttendanceRecord() {
        when(repository.findByAttendanceRecordId(RECORD)).thenReturn(Optional.of(pending()));

        assertThrows(DuplicateEntityException.class, () -> create.create(pending()));
        verify(repository, never()).save(any());
    }

    @Test
    void aRaceOnTheUniqueConstraintIsADuplicate() {
        Justification input = pending();
        when(repository.findByAttendanceRecordId(RECORD)).thenReturn(Optional.empty());
        when(repository.save(input)).thenThrow(new DataIntegrityViolationException("uq_justification_record"));

        assertThrows(DuplicateEntityException.class, () -> create.create(input));
    }

    @Test
    void aLateArrivalCanBeJustified() {
        when(recordRepository.findById(RECORD)).thenReturn(Optional.of(record("Late")));
        when(repository.findByAttendanceRecordId(RECORD)).thenReturn(Optional.empty());

        assertEquals("Pending", create.create(pending()).getReviewStatus());
    }

    @Test
    void aPresentRecordCannotBeJustified() {
        when(recordRepository.findById(RECORD)).thenReturn(Optional.of(record("Present")));

        assertThrows(ValidationException.class, () -> create.create(pending()));
        verify(repository, never()).save(any());
    }

    @Test
    void justifyingAMissingRecordIsNotFound() {
        when(recordRepository.findById(RECORD)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> create.create(pending()));
        verify(repository, never()).save(any());
    }

    @Test
    void aReasonIsRequired() {
        Justification input = pending();
        input.setReason("  ");

        assertThrows(IllegalArgumentException.class, () -> create.create(input));
    }

    @Test
    void approvingRecordsTheReviewerTheTimeAndTheNotes() {
        UUID reviewer = UUID.randomUUID();
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));

        Justification result = review.review(ID, "Approved", reviewer, "Certificate verified");

        assertEquals("Approved", result.getReviewStatus());
        assertEquals(reviewer, result.getReviewedBy());
        assertNotNull(result.getReviewedAt());
        assertEquals("Certificate verified", result.getResolutionNotes());
    }

    @Test
    void rejectingWorksTheSameWay() {
        UUID reviewer = UUID.randomUUID();
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));

        Justification result = review.review(ID, "Rejected", reviewer, "Document unreadable");

        assertEquals("Rejected", result.getReviewStatus());
        assertEquals(reviewer, result.getReviewedBy());
    }

    @Test
    void rejectingNeedsAResolutionComment() {
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));

        assertThrows(ValidationException.class, () -> review.review(ID, "Rejected", UUID.randomUUID(), null));
        assertThrows(ValidationException.class, () -> review.review(ID, "Rejected", UUID.randomUUID(), "   "));
        verify(repository, never()).save(any());
        verify(eventPublisher, never()).publishAfterCommit(anyString(), anyString(), anyString());
    }

    @Test
    void approvingNeedsNoComment() {
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));

        assertEquals("Approved", review.review(ID, "Approved", UUID.randomUUID(), "  ").getReviewStatus());
    }

    @Test
    void aReviewCannotGoBackToPending() {
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));

        assertThrows(ValidationException.class, () -> review.review(ID, "Pending", UUID.randomUUID(), null));
        verify(repository, never()).save(any());
    }

    @Test
    void anUnknownStatusIsRejected() {
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));

        assertThrows(ValidationException.class, () -> review.review(ID, "Maybe", UUID.randomUUID(), null));
        assertThrows(ValidationException.class, () -> review.review(ID, null, UUID.randomUUID(), null));
    }

    @Test
    void reviewingAMissingJustificationIsNotFound() {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> review.review(ID, "Approved", UUID.randomUUID(), null));
    }

    private JustificationType typeRequiringAttachment(boolean requires) {
        JustificationType type = new JustificationType();
        type.setJustificationTypeId(1);
        type.setRequiresAttachment(requires);
        return type;
    }

    @Test
    void approvingNeedsADocumentWhenTheTypeRequiresOne() {
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));
        when(typeRepository.findById(1)).thenReturn(Optional.of(typeRequiringAttachment(true)));
        when(documentRepository.findByJustificationId(ID)).thenReturn(List.of());

        assertThrows(ValidationException.class, () -> review.review(ID, "Approved", UUID.randomUUID(), null));
        verify(repository, never()).save(any());
    }

    @Test
    void approvingWorksOnceTheRequiredDocumentIsThere() {
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));
        when(typeRepository.findById(1)).thenReturn(Optional.of(typeRequiringAttachment(true)));
        when(documentRepository.findByJustificationId(ID)).thenReturn(List.of(new SupportingDocument()));

        assertEquals("Approved", review.review(ID, "Approved", UUID.randomUUID(), "ok").getReviewStatus());
    }

    @Test
    void rejectingNeverNeedsADocument() {
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));

        assertEquals("Rejected", review.review(ID, "Rejected", UUID.randomUUID(), "no proof").getReviewStatus());
        verify(documentRepository, never()).findByJustificationId(any());
    }

    @Test
    void aTypeWithoutAttachmentRequirementApprovesWithoutDocuments() {
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));
        when(typeRepository.findById(1)).thenReturn(Optional.of(typeRequiringAttachment(false)));

        assertEquals("Approved", review.review(ID, "Approved", UUID.randomUUID(), null).getReviewStatus());
    }

    @Test
    void aResolvedJustificationCannotBeReviewedAgain() {
        Justification resolved = pending();
        resolved.setReviewStatus("Approved");
        when(repository.findById(ID)).thenReturn(Optional.of(resolved));

        assertThrows(ValidationException.class, () -> review.review(ID, "Rejected", UUID.randomUUID(), null));
        assertThrows(ValidationException.class, () -> review.review(ID, "Approved", UUID.randomUUID(), null));
        verify(repository, never()).save(any());
    }

    @Test
    void aReviewPublishesJustificationReviewedForTheApprentice() {
        AttendanceRecord record = new AttendanceRecord();
        record.setAttendanceRecordId(RECORD);
        record.setAcademicActorId(77L);
        when(repository.findById(ID)).thenReturn(Optional.of(pending()));
        when(recordRepository.findById(RECORD)).thenReturn(Optional.of(record));

        Justification result = review.review(ID, "Rejected", UUID.randomUUID(), "Document unreadable");

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(eventPublisher).publishAfterCommit(eq("attendance.justification.events"), eq(String.valueOf(ID)), payload.capture());
        assertTrue(payload.getValue().contains("\"eventType\":\"JustificationReviewed\""));
        assertTrue(payload.getValue().contains("\"academicActorId\":77"));
        assertTrue(payload.getValue().contains("\"status\":\"Rejected\""));
        assertTrue(payload.getValue().contains("\"reviewedAt\":\"" + result.getReviewedAt() + "\""));
    }

    @Test
    void aFailedReviewPublishesNothing() {
        Justification resolved = pending();
        resolved.setReviewStatus("Approved");
        when(repository.findById(ID)).thenReturn(Optional.of(resolved));

        assertThrows(ValidationException.class, () -> review.review(ID, "Rejected", UUID.randomUUID(), null));
        verify(eventPublisher, never()).publishAfterCommit(anyString(), anyString(), anyString());
    }
}
