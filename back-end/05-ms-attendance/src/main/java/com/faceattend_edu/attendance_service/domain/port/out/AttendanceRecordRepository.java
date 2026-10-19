package com.faceattend_edu.attendance_service.domain.port.out;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordSlice;
import java.util.List;
import java.util.Optional;

public interface AttendanceRecordRepository {
    AttendanceRecord save(AttendanceRecord r);
    Optional<AttendanceRecord> findById(Long id);
    Optional<AttendanceRecord> findByClassSessionIdAndAcademicActorId(Long sessionId, Long actorId);
    List<AttendanceRecord> findAll();
    List<AttendanceRecord> findByClassSessionId(Long sessionId);
    /** Filtra y pagina en SQL, ordenado por id; {@code limit} null devuelve todas las filas. */
    AttendanceRecordSlice search(AttendanceRecordFilter filter, int offset, Integer limit);
    void deleteById(Long id);
    boolean existsById(Long id);
}
