package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.exception.ValidationException;
import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.port.in.OpenClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class OpenClassSessionUseCaseImpl implements OpenClassSessionUseCase {
    private final ClassSessionRepository repository;
    @Override @Transactional
    public ClassSession open(Long id, Long openedBy) {
        ClassSession session = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("ClassSession", id));
        if (session.isOpen()) throw new ValidationException("ClassSession already Open");
        if (session.isClosed() || session.isCancelled()) throw new ValidationException("Cannot open a session that is " + session.getSessionStatus());
        session.setSessionStatus("Open");
        session.setOpenedBy(openedBy);
        session.setOpenedAt(Instant.now());
        session.touchUpdated();
        return repository.save(session);
    }
}
