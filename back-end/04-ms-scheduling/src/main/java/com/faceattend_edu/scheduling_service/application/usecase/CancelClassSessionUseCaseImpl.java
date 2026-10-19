package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.scheduling_service.domain.exception.ValidationException;
import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.port.in.CancelClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CancelClassSessionUseCaseImpl implements CancelClassSessionUseCase {
    private final ClassSessionRepository repository;
    @Override @Transactional
    public ClassSession cancel(Long id) {
        ClassSession session = repository.findById(id).orElseThrow(() -> new EntityNotFoundException("ClassSession", id));
        if (session.isCancelled()) throw new ValidationException("ClassSession already Cancelled");
        if (session.isClosed()) throw new ValidationException("Cannot cancel a Closed session");
        session.setSessionStatus("Cancelled");
        session.touchUpdated();
        return repository.save(session);
    }
}
