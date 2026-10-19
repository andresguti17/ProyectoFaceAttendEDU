package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.port.in.UpdateClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UpdateClassSessionUseCaseImpl implements UpdateClassSessionUseCase {
    private final ClassSessionRepository repository;
    @Override public ClassSession update(Long id, ClassSession session) {
        ClassSession existing = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("ClassSession", id));
        if (session.getScheduleBlockId() != null) existing.setScheduleBlockId(session.getScheduleBlockId());
        if (session.getSessionDate() != null) existing.setSessionDate(session.getSessionDate());
        if (session.getSessionStatus() != null) existing.setSessionStatus(session.getSessionStatus());
        existing.validate();
        existing.touchUpdated();
        return repository.save(existing);
    }
}
