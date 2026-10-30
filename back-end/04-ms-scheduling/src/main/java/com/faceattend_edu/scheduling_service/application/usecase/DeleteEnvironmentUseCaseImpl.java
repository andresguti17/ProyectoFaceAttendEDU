package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.port.in.DeleteEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.EnvironmentRepository;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteEnvironmentUseCaseImpl implements DeleteEnvironmentUseCase {

    private final EnvironmentRepository repository;
    private final ScheduleBlockRepository blocks;

    @Override
    public void delete(Integer id) {
        if (!repository.existsById(id)) throw new EntityNotFoundException("Environment", id);
        // Un ambiente con bloques vivos los dejaria huerfanos: la lista de bloques del Administrador responderia 404.
        if (blocks.existsByEnvironmentId(id)) {
            throw new DuplicateEntityException("Environment " + id + " still has schedule blocks; delete them first");
        }
        repository.deleteById(id);
    }
}
