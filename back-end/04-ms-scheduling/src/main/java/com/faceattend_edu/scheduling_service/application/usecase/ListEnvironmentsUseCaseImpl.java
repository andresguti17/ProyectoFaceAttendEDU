package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.port.in.ListEnvironmentsUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.EnvironmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ListEnvironmentsUseCaseImpl implements ListEnvironmentsUseCase {

    private final EnvironmentRepository repository;

    @Override
    public List<Environment> list() { return repository.findAll(); }

    @Override
    public List<Environment> listBySchoolId(Integer schoolId) { return repository.findBySchoolId(schoolId); }
}
