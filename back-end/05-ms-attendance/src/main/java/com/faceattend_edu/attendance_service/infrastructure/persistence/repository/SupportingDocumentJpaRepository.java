package com.faceattend_edu.attendance_service.infrastructure.persistence.repository;

import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.SupportingDocumentJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SupportingDocumentJpaRepository extends JpaRepository<SupportingDocumentJpaEntity, Long> {
    List<SupportingDocumentJpaEntity> findByJustificationId(Long justificationId);
}
