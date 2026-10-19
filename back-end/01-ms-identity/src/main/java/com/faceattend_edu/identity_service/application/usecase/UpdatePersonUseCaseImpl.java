package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.UpdatePersonUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.UpdatePersonPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.Person;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@RequiredArgsConstructor
@Service
public class UpdatePersonUseCaseImpl implements UpdatePersonUseCase {

    private final LoadPersonPort loadPersonPort;
    private final UpdatePersonPort updatePersonPort;

    @Override
    @Transactional
    public void updatePerson(UUID personId, Person incoming) {
        Person existing = loadPersonPort.loadPerson(personId);
        if (existing == null) throw new EntityNotFoundException("Person", personId);

        incoming.setPersonId(personId);
        incoming.setCreatedAt(existing.getCreatedAt());
        incoming.setCreatedBy(existing.getCreatedBy());
        incoming.setRowVersion(existing.getRowVersion());
        if (incoming.getStatus() == null) incoming.setStatus(existing.getStatus());

        incoming.validate();
        incoming.setUpdatedAt(LocalDateTime.now());
        updatePersonPort.updatePerson(incoming);
    }
}
