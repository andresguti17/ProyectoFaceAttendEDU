package com.faceattend_edu.identity_service.adapter.out.persistence.repository;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.PersonJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.UUID;

public interface PersonJpaRepository extends JpaRepository<PersonJpaEntity, UUID> {

    /**
     * Roster used by list/count. Soft-deleted persons (deleted_at NOT NULL) are excluded so the
     * padron agrees with the model's soft-delete rule (AGENTS.md §2.2) and the CSV import no longer
     * flags a deleted person as "already exists".
     */
    @Query("select p from PersonJpaEntity p where p.deletedAt is null")
    Page<PersonJpaEntity> findAllActive(Pageable pageable);

    @Query("select count(p) from PersonJpaEntity p where p.deletedAt is null")
    long countActive();
}
