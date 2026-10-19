package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.port.in.ListClassSessionsUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ListClassSessionsUseCaseImpl implements ListClassSessionsUseCase {
    private final ClassSessionRepository repository;
    @Override public List<ClassSession> list() { return repository.findAll(); }
}
