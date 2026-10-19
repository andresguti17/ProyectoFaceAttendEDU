package com.faceattend_edu.attendance_service.infrastructure.persistence.repository;

import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.JustificationTypeJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface JustificationTypeJpaRepository extends JpaRepository<JustificationTypeJpaEntity, Integer> {
    Optional<JustificationTypeJpaEntity> findByName(String name);
    Optional<JustificationTypeJpaEntity> findByNameAndSchoolId(String name, Integer schoolId);
    Optional<JustificationTypeJpaEntity> findByNameAndSchoolIdIsNull(String name);
}
