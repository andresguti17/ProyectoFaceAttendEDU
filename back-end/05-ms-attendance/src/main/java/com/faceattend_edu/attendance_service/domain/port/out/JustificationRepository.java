package com.faceattend_edu.attendance_service.domain.port.out;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.model.JustificationFilter;
import com.faceattend_edu.attendance_service.domain.model.JustificationSlice;
import java.util.List;
import java.util.Optional;

public interface JustificationRepository {
    Justification save(Justification j);
    Optional<Justification> findById(Long id);
    Optional<Justification> findByAttendanceRecordId(Long attendanceRecordId);
    JustificationSlice search(JustificationFilter filter, int offset, Integer limit);
    void deleteById(Long id);
    boolean existsById(Long id);
}
