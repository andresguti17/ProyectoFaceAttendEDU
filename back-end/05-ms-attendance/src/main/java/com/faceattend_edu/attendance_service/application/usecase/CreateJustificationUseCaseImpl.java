package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.port.in.CreateJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class CreateJustificationUseCaseImpl implements CreateJustificationUseCase {
    private final JustificationRepository repository;
    private final AttendanceRecordRepository recordRepository;
    private final DomainEventPublisher eventPublisher;
    /** ERF 6.1: solo se justifican inasistencias y llegadas tarde. */
    private static final Set<String> JUSTIFIABLE = Set.of("Absent", "Late");
    @Override public Justification create(Justification j){
        j.validate(); j.touchCreated();
        String status = recordRepository.findById(j.getAttendanceRecordId())
                .orElseThrow(() -> new EntityNotFoundException("AttendanceRecord", j.getAttendanceRecordId()))
                .getAttendanceStatus();
        if (!JUSTIFIABLE.contains(status)) throw new ValidationException("Only Absent or Late attendance records can be justified; this one is " + status);
        repository.findByAttendanceRecordId(j.getAttendanceRecordId()).ifPresent(existing -> { throw new DuplicateEntityException("Justification already exists for attendanceRecordId=" + j.getAttendanceRecordId()); });
        try {
            Justification saved = repository.save(j);
            eventPublisher.publish("justification-events", "{\"justificationId\":" + saved.getJustificationId() + ",\"status\":\"" + saved.getReviewStatus() + "\"}");
            return saved;
        } catch (DataIntegrityViolationException ex){ throw new DuplicateEntityException("Justification duplicate violates unique constraint (attendance_record_id)", ex); }
    }
}
