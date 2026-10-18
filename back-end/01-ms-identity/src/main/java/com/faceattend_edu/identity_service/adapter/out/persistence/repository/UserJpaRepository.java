package com.faceattend_edu.identity_service.adapter.out.persistence.repository;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.UserJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserJpaRepository extends JpaRepository<UserJpaEntity, UUID> {
    // Unfiltered on purpose: this is the "username already exists" guard for creation, and
    // uq_user_username is a FULL unique index (not partial), so a soft-deleted user still
    // reserves the username. Filtering here would let creation violate the DB constraint.
    Optional<UserJpaEntity> findByUsername(String username);

    /**
     * Roster used by list/count. Soft-deleted users (deleted_at NOT NULL) are excluded so the
     * admin list agrees with the model's soft-delete rule (AGENTS.md §2.2).
     */
    @Query("select u from UserJpaEntity u where u.deletedAt is null")
    Page<UserJpaEntity> findAllActive(Pageable pageable);

    @Query("select count(u) from UserJpaEntity u where u.deletedAt is null")
    long countActive();

    /**
     * School-scoped roster: same soft-delete rule as findAllActive, restricted to the
     * persons the caller is allowed to see (CallerScopeResolver via AuthTokenFilter).
     */
    @Query("select u from UserJpaEntity u where u.deletedAt is null and u.person.personId in :personIds")
    Page<UserJpaEntity> findAllActiveInPersons(@Param("personIds") Collection<UUID> personIds, Pageable pageable);

    @Query("select count(u) from UserJpaEntity u where u.deletedAt is null and u.person.personId in :personIds")
    long countActiveInPersons(@Param("personIds") Collection<UUID> personIds);

    /**
     * Email lookup used by login. Soft-deleted users and persons are excluded so the result
     * always agrees with the partial unique index uq_person_email (WHERE deleted_at IS NULL).
     */
    @Query("""
            select u from UserJpaEntity u
                join u.person p
                where lower(p.email) = lower(:email)
                  and u.deletedAt is null
                  and p.deletedAt is null
            """)
    List<UserJpaEntity> findByPersonEmail(@Param("email") String email);
}
