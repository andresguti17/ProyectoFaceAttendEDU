package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.in.CreateAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateAttendanceRecordUseCaseImpl implements CreateAttendanceRecordUseCase {
    private final AttendanceRecordRepository repository;
    private final DomainEventPublisher eventPublisher;

    @Override @Transactional
    public AttendanceRecord create(AttendanceRecord record) {
        record.validate();
        record.touchCreated();
        repository.findByClassSessionIdAndAcademicActorId(record.getClassSessionId(), record.getAcademicActorId()).ifPresent(r -> {
            throw new DuplicateEntityException("AttendanceRecord already exists for session=" + record.getClassSessionId() + " actor=" + record.getAcademicActorId());
        });
        try {
            AttendanceRecord saved = repository.save(record);
            eventPublisher.publish("attendance-events", "{\"attendanceRecordId\":" + saved.getAttendanceRecordId() + ",\"status\":\"" + saved.getAttendanceStatus() + "\"}");
            return saved;
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateEntityException("AttendanceRecord duplicate violates unique constraint (class_session_id, academic_actor_id)", ex);
        }
    }
}
