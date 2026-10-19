package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.in.UpdateScheduleBlockUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UpdateScheduleBlockUseCaseImpl implements UpdateScheduleBlockUseCase {

    private final ScheduleBlockRepository repository;
    private final ScheduleBlockOverlapGuard overlapGuard;

    @Override
    public ScheduleBlock update(Long id, ScheduleBlock block) {
        ScheduleBlock existing = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("ScheduleBlock", id));
        if (block.getCohortId() != null) existing.setCohortId(block.getCohortId());
        if (block.getCourseId() != null) existing.setCourseId(block.getCourseId());
        if (block.getEnvironmentId() != null) existing.setEnvironmentId(block.getEnvironmentId());
        if (block.getInstructorActorId() != null) existing.setInstructorActorId(block.getInstructorActorId());
        if (block.getDayOfWeek() != null) existing.setDayOfWeek(block.getDayOfWeek());
        if (block.getStartsAt() != null) existing.setStartsAt(block.getStartsAt());
        if (block.getEndsAt() != null) existing.setEndsAt(block.getEndsAt());
        existing.validate();
        overlapGuard.check(existing, id);
        existing.touchUpdated();
        try {
            return repository.save(existing);
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateEntityException("ScheduleBlock double-booking violates unique constraint", ex);
        }
    }
}
