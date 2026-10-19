package com.faceattend_edu.scheduling_service.domain.port.out;

import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

public interface ScheduleBlockRepository {
    ScheduleBlock save(ScheduleBlock block);
    Optional<ScheduleBlock> findById(Long id);
    List<ScheduleBlock> findAll();
    void deleteById(Long id);
    boolean existsById(Long id);

    /** True if another live block in the room overlaps the interval on that weekday ({@code excludeId} skips the block being edited). */
    boolean existsEnvironmentOverlap(Integer environmentId, Short dayOfWeek, LocalTime startsAt, LocalTime endsAt, Long excludeId);

    /** True if another live block of the instructor overlaps the interval on that weekday. */
    boolean existsInstructorOverlap(Long instructorActorId, Short dayOfWeek, LocalTime startsAt, LocalTime endsAt, Long excludeId);
}
