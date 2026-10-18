package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.port.in.ReviewJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationRepository;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;

/**
 * Review of a justification: {@code Pending -> Approved | Rejected}, once.
 * A resolved justification is final, and approving one whose type requires an
 * attachment needs at least one supporting document.
 */
@Service
@RequiredArgsConstructor
public class ReviewJustificationUseCaseImpl implements ReviewJustificationUseCase {
    private final JustificationRepository repository;
    private final JustificationTypeRepository typeRepository;
    private final SupportingDocumentRepository documentRepository;
    private final AttendanceRecordRepository recordRepository;
    private final DomainEventPublisher eventPublisher;
    /** Tópico del catálogo de eventos (fae-docs 09-microservices/event-catalog.md). */
    static final String TOPIC = "attendance.justification.events";
    private static final Set<String> ALLOWED = Set.of("Approved","Rejected","Pending");

    @Override @Transactional
    public Justification review(Long id, String reviewStatus, UUID reviewedBy, String resolutionNotes){
        Justification j = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("Justification", id));
        if (reviewStatus == null || !ALLOWED.contains(reviewStatus)) throw new ValidationException("reviewStatus must be one of " + ALLOWED);
        if ("Pending".equals(reviewStatus)) throw new ValidationException("Cannot review to Pending");
        if (!"Pending".equals(j.getReviewStatus())) {
            throw new ValidationException("Justification already " + j.getReviewStatus() + "; a resolved justification cannot be reviewed again");
        }
        // ERF 6.2: el aprendiz debe saber por qué se rechazó.
        if ("Rejected".equals(reviewStatus) && (resolutionNotes == null || resolutionNotes.isBlank())) {
            throw new ValidationException("resolutionNotes is required to reject a justification");
        }
        if ("Approved".equals(reviewStatus) && requiresAttachment(j) && documentRepository.findByJustificationId(id).isEmpty()) {
            throw new ValidationException("This justification type requires at least one supporting document before it can be approved");
        }
        j.setReviewStatus(reviewStatus);
        j.setReviewedBy(reviewedBy);
        // Microsegundos: es la precisión de la columna, así la fecha del evento coincide con la guardada.
        j.setReviewedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        j.setResolutionNotes(resolutionNotes);
        j.touchUpdated();
        Justification saved = repository.save(j);
        publishReviewed(saved);
        return saved;
    }

    /** ERF 6.3: Notification avisa al aprendiz (actor del registro) del resultado. */
    private void publishReviewed(Justification j) {
        Long actorId = recordRepository.findById(j.getAttendanceRecordId())
                .map(r -> r.getAcademicActorId()).orElse(null);
        String payload = String.format(
                "{\"eventType\":\"JustificationReviewed\",\"version\":1,\"justificationId\":%d,\"attendanceRecordId\":%d,"
                        + "\"academicActorId\":%s,\"status\":\"%s\",\"reviewedAt\":\"%s\"}",
                j.getJustificationId(), j.getAttendanceRecordId(), actorId, j.getReviewStatus(), j.getReviewedAt());
        eventPublisher.publishAfterCommit(TOPIC, String.valueOf(j.getJustificationId()), payload);
    }

    private boolean requiresAttachment(Justification j) {
        return typeRepository.findById(j.getJustificationTypeId())
                .map(type -> Boolean.TRUE.equals(type.getRequiresAttachment()))
                .orElse(false);
    }
}
