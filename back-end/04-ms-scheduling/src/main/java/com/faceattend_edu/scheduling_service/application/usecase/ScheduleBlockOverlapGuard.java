package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * A room or an instructor cannot hold two blocks whose time ranges intersect on
 * the same weekday. The unique constraints only catch identical start times, so
 * the interval check lives here. Touching ranges (10:00 end, 10:00 start) are fine.
 */
@Component
@RequiredArgsConstructor
public class ScheduleBlockOverlapGuard {

    private final ScheduleBlockRepository repository;

    /** @param excludeId the block being edited, or {@code null} for a new one */
    public void check(ScheduleBlock block, Long excludeId) {
        if (repository.existsEnvironmentOverlap(block.getEnvironmentId(), block.getDayOfWeek(),
                block.getStartsAt(), block.getEndsAt(), excludeId)) {
            throw new DuplicateEntityException("Environment " + block.getEnvironmentId()
                    + " is already booked between " + block.getStartsAt() + " and " + block.getEndsAt()
                    + " on day " + block.getDayOfWeek());
        }
        if (repository.existsInstructorOverlap(block.getInstructorActorId(), block.getDayOfWeek(),
                block.getStartsAt(), block.getEndsAt(), excludeId)) {
            throw new DuplicateEntityException("Instructor " + block.getInstructorActorId()
                    + " already has a block between " + block.getStartsAt() + " and " + block.getEndsAt()
                    + " on day " + block.getDayOfWeek());
        }
    }
}
