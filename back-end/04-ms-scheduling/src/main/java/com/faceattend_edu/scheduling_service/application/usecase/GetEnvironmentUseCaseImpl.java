package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.port.in.GetEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.EnvironmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetEnvironmentUseCaseImpl implements GetEnvironmentUseCase {

    private final EnvironmentRepository repository;

    @Override
    public Environment getById(Integer id) {
        return repository.findById(id).orElseThrow(() -> new EntityNotFoundException("Environment", id));
    }
}
