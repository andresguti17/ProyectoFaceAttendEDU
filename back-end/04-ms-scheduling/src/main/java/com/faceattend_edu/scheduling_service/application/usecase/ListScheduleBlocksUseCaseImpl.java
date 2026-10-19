package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.in.ListScheduleBlocksUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ScheduleBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ListScheduleBlocksUseCaseImpl implements ListScheduleBlocksUseCase {
    private final ScheduleBlockRepository repository;
    @Override public List<ScheduleBlock> list() { return repository.findAll(); }
}
