package com.faceattend_edu.scheduling_service.application.usecase;

import com.faceattend_edu.scheduling_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.port.in.CreateClassSessionUseCase;
import com.faceattend_edu.scheduling_service.domain.port.out.ClassSessionRepository;
import com.faceattend_edu.scheduling_service.infrastructure.messaging.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CreateClassSessionUseCaseImpl implements CreateClassSessionUseCase {
    private final ClassSessionRepository repository;
    private final DomainEventPublisher eventPublisher;
    @Override public ClassSession create(ClassSession session) {
        session.touchCreated();
        session.validate();
        try {
            ClassSession saved = repository.save(session);
            eventPublisher.publish("class-session-events", "{\"classSessionId\":" + saved.getClassSessionId() + ",\"scheduleBlockId\":" + saved.getScheduleBlockId() + "}");
            return saved;
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateEntityException("ClassSession duplicate violates unique constraint (schedule_block_id, session_date)", ex);
        }
    }
}
