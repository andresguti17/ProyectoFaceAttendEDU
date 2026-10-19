package com.faceattend_edu.scheduling_service.infrastructure.persistence.repository;

import com.faceattend_edu.scheduling_service.infrastructure.persistence.entity.EnvironmentJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EnvironmentJpaRepository extends JpaRepository<EnvironmentJpaEntity, Integer> {
    Optional<EnvironmentJpaEntity> findBySchoolIdAndCode(Integer schoolId, String code);
    List<EnvironmentJpaEntity> findBySchoolId(Integer schoolId);
}
