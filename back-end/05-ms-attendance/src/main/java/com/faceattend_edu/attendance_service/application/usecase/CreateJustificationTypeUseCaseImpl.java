package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.port.in.CreateJustificationTypeUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CreateJustificationTypeUseCaseImpl implements CreateJustificationTypeUseCase {
    private final JustificationTypeRepository repository;
    private final DomainEventPublisher eventPublisher;
    @Override public JustificationType create(JustificationType type){
        type.validate(); type.touchCreated();
        if (type.getSchoolId() == null) {
            repository.findByNameAndSchoolIdIsNull(type.getName()).ifPresent(t -> { throw new DuplicateEntityException("Global JustificationType already exists with name=" + type.getName()); });
        } else {
            repository.findByNameAndSchoolId(type.getName(), type.getSchoolId()).ifPresent(t -> { throw new DuplicateEntityException("JustificationType already exists with name=" + type.getName() + " for schoolId=" + type.getSchoolId()); });
        }
        try {
            JustificationType saved = repository.save(type);
            eventPublisher.publish("justification-type-events", "{\"justificationTypeId\":" + saved.getJustificationTypeId() + ",\"name\":\"" + saved.getName() + "\"}");
            return saved;
        } catch (DataIntegrityViolationException ex){ throw new DuplicateEntityException("JustificationType duplicate violates unique constraint", ex); }
    }
}
