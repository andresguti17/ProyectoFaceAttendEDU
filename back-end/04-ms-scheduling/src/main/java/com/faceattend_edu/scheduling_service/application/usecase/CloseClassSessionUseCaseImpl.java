package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.exception.ValidationException;
import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.port.in.CloseClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class CloseClassSessionUseCaseImpl implements CloseClassSessionUseCase {
    private final ClassSessionRepository repository;
    @Override @Transactional
    public ClassSession close(Long id, Long closedBy) {
        ClassSession session = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("ClassSession", id));
        if (session.isClosed()) throw new ValidationException("ClassSession already Closed");
        if (session.isCancelled()) throw new ValidationException("Cannot close a Cancelled session");
        session.setSessionStatus("Closed");
        session.setClosedBy(closedBy);
        session.setClosedAt(Instant.now());
        session.touchUpdated();
        return repository.save(session);
    }
}
