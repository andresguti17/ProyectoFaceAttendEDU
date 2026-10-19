package com.faceattend_edu.attendance_service.infrastructure.persistence.repository;

import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.JustificationJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface JustificationJpaRepository extends JpaRepository<JustificationJpaEntity, Long> {
    Optional<JustificationJpaEntity> findByAttendanceRecordId(Long attendanceRecordId);
}
