package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.port.in.DeleteEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.EnvironmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteEnvironmentUseCaseImpl implements DeleteEnvironmentUseCase {

    private final EnvironmentRepository repository;

    @Override
    public void delete(Integer id) {
        if (!repository.existsById(id)) throw new EntityNotFoundException("Environment", id);
        repository.deleteById(id);
    }
}
