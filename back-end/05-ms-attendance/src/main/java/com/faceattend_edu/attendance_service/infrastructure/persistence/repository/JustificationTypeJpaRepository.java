package com.faceattend_edu.attendance_service.infrastructure.persistence.repository;

import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.JustificationTypeJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface JustificationTypeJpaRepository extends JpaRepository<JustificationTypeJpaEntity, Integer> {
    Optional<JustificationTypeJpaEntity> findByName(String name);
    Optional<JustificationTypeJpaEntity> findByNameAndSchoolId(String name, Integer schoolId);
    Optional<JustificationTypeJpaEntity> findByNameAndSchoolIdIsNull(String name);

    /**
     * Native on purpose: a justification filed under a type that was deleted later must still demand its attachment,
     * and the entity's @SQLRestriction hides deleted rows from every JPQL and derived query.
     */
    @Query(value = "select \"requires_attachment\" from {h-schema}\"justification_type\" where \"justification_type_id\" = :id", nativeQuery = true)
    Optional<Boolean> findRequiresAttachmentIncludingDeleted(@Param("id") Integer id);
}
