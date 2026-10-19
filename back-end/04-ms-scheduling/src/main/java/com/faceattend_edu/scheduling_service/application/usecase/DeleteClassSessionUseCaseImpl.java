package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.port.in.DeleteClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteClassSessionUseCaseImpl implements DeleteClassSessionUseCase {
    private final ClassSessionRepository repository;
    @Override public void delete(Long id) {
        if (!repository.existsById(id)) throw new EntityNotFoundException("ClassSession", id);
        repository.deleteById(id);
    }
}
