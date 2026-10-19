package com.faceattend_edu.scheduling_service.infrastructure.persistence.repository;

import com.faceattend_edu.scheduling_service.infrastructure.persistence.entity.ScheduleBlockJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalTime;

public interface ScheduleBlockJpaRepository extends JpaRepository<ScheduleBlockJpaEntity, Long> {

    @Query("""
            select count(b) > 0 from ScheduleBlockJpaEntity b
            where b.deletedAt is null and b.environmentId = :environmentId and b.dayOfWeek = :dayOfWeek
              and b.startsAt < :endsAt and b.endsAt > :startsAt
              and (:excludeId is null or b.scheduleBlockId <> :excludeId)
            """)
    boolean existsEnvironmentOverlap(@Param("environmentId") Integer environmentId, @Param("dayOfWeek") Short dayOfWeek,
                                     @Param("startsAt") LocalTime startsAt, @Param("endsAt") LocalTime endsAt,
                                     @Param("excludeId") Long excludeId);

    @Query("""
            select count(b) > 0 from ScheduleBlockJpaEntity b
            where b.deletedAt is null and b.instructorActorId = :instructorActorId and b.dayOfWeek = :dayOfWeek
              and b.startsAt < :endsAt and b.endsAt > :startsAt
              and (:excludeId is null or b.scheduleBlockId <> :excludeId)
            """)
    boolean existsInstructorOverlap(@Param("instructorActorId") Long instructorActorId, @Param("dayOfWeek") Short dayOfWeek,
                                    @Param("startsAt") LocalTime startsAt, @Param("endsAt") LocalTime endsAt,
                                    @Param("excludeId") Long excludeId);
}
