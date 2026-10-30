package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.application.policy.ArrivalStatusPolicy;
import com.faceattend_edu.attendance_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.in.RecordAttendanceUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class RecordAttendanceUseCaseImpl implements RecordAttendanceUseCase {
    private final AttendanceRecordRepository repository;
    private final ArrivalStatusPolicy arrivalPolicy;

    @Override @Transactional
    public AttendanceRecord record(Long classSessionId, Long academicActorId, String attendanceStatus, String captureMethod, BigDecimal matchScore) {
        AttendanceRecord r = new AttendanceRecord();
        r.setClassSessionId(classSessionId);
        r.setAcademicActorId(academicActorId);
        r.setCaptureMethod(captureMethod);
        r.setMatchScore(matchScore);
        // An absence has no capture: captured_at stays NULL (see AttendanceRecord.touchCreated).
        r.setCapturedAt("Absent".equals(attendanceStatus) ? null : Instant.now());
        // Lateness of a biometric arrival comes from the server clock, not from the status the caller sent (N-14).
        r.setAttendanceStatus(arrivalPolicy.resolve(classSessionId, academicActorId, attendanceStatus, captureMethod, r.getCapturedAt()));
        r.validate();
        r.touchCreated();
        repository.findByClassSessionIdAndAcademicActorId(classSessionId, academicActorId).ifPresent(existing -> {
            throw new DuplicateEntityException("Duplicate attendance for session=" + classSessionId + " actor=" + academicActorId);
        });
        try {
            return repository.save(r);
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateEntityException("Duplicate attendance violates unique constraint (class_session_id, academic_actor_id)", ex);
        }
    }
}
