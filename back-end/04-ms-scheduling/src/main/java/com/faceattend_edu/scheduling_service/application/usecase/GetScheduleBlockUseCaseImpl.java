package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.in.GetScheduleBlockUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetScheduleBlockUseCaseImpl implements GetScheduleBlockUseCase {
    private final ScheduleBlockRepository repository;
    @Override public ScheduleBlock getById(Long id) {
        return repository.findById(id).orElseThrow(() -> new EntityNotFoundException("ScheduleBlock", id));
    }
}
