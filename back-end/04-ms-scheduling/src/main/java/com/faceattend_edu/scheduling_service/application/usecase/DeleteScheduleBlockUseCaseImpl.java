package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.port.in.DeleteScheduleBlockUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteScheduleBlockUseCaseImpl implements DeleteScheduleBlockUseCase {
    private final ScheduleBlockRepository repository;
    @Override public void delete(Long id) {
        if (!repository.existsById(id)) throw new EntityNotFoundException("ScheduleBlock", id);
        repository.deleteById(id);
    }
}
