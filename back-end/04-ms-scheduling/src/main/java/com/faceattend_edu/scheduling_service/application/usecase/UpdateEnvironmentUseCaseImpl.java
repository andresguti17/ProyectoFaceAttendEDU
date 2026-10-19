package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.port.in.UpdateEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.EnvironmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UpdateEnvironmentUseCaseImpl implements UpdateEnvironmentUseCase {

    private final EnvironmentRepository repository;

    @Override
    public Environment update(Integer id, Environment environment) {
        Environment existing = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("Environment", id));
        if (environment.getSchoolId() != null) existing.setSchoolId(environment.getSchoolId());
        if (environment.getCode() != null) existing.setCode(environment.getCode());
        if (environment.getName() != null) existing.setName(environment.getName());
        if (environment.getCapacity() != null) existing.setCapacity(environment.getCapacity());
        if (environment.getStatus() != null) existing.setStatus(environment.getStatus());
        existing.validate();
        existing.touchUpdated();
        return repository.save(existing);
    }
}
