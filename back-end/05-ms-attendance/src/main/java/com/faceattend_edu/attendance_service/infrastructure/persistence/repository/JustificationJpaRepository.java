package com.faceattend_edu.attendance_service.infrastructure.persistence.repository;

import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.JustificationJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.Optional;

public interface JustificationJpaRepository extends JpaRepository<JustificationJpaEntity, Long> {
    Optional<JustificationJpaEntity> findByAttendanceRecordId(Long attendanceRecordId);

    /** Same contract as AttendanceRecordJpaRepository.search: the scope goes through the justified record's actor. */
    @Query(value = """
            select j from JustificationJpaEntity j
             where j.deletedAt is null
               and (:byStatus = false or j.reviewStatus = :status)
               and (:byRecord = false or j.attendanceRecordId = :recordId)
               and (:byScope = false or j.attendanceRecordId in (
                    select r.attendanceRecordId from AttendanceRecordJpaEntity r
                     where r.academicActorId in :scopeIds))
             order by j.justificationId
            """,
            countQuery = """
            select count(j) from JustificationJpaEntity j
             where j.deletedAt is null
               and (:byStatus = false or j.reviewStatus = :status)
               and (:byRecord = false or j.attendanceRecordId = :recordId)
               and (:byScope = false or j.attendanceRecordId in (
                    select r.attendanceRecordId from AttendanceRecordJpaEntity r
                     where r.academicActorId in :scopeIds))
            """)
    Page<JustificationJpaEntity> search(@Param("byStatus") boolean byStatus, @Param("status") String status,
                                        @Param("byRecord") boolean byRecord, @Param("recordId") long recordId,
                                        @Param("byScope") boolean byScope, @Param("scopeIds") Collection<Long> scopeIds,
                                        Pageable pageable);
}
