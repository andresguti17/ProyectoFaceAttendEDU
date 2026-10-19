package com.faceattend_edu.scheduling_service.infrastructure.persistence.repository;

import com.faceattend_edu.scheduling_service.infrastructure.persistence.entity.ClassSessionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ClassSessionJpaRepository extends JpaRepository<ClassSessionJpaEntity, Long> {
    List<ClassSessionJpaEntity> findByScheduleBlockId(Long scheduleBlockId);
}
