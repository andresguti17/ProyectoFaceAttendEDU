package com.faceattend_edu.attendance_service.domain.port.out;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import java.util.List;
import java.util.Optional;

public interface JustificationRepository {
    Justification save(Justification j);
    Optional<Justification> findById(Long id);
    Optional<Justification> findByAttendanceRecordId(Long attendanceRecordId);
    List<Justification> findAll();
    void deleteById(Long id);
    boolean existsById(Long id);
}
