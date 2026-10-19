package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ChangePersonStatusUseCase;
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
public class ChangePersonStatusUseCaseImpl implements ChangePersonStatusUseCase {

    private final LoadPersonPort loadPersonPort;
    private final UpdatePersonPort updatePersonPort;

    @Override
    @Transactional
    public void changeStatus(UUID personId, boolean status) {
        Person person = loadPersonPort.loadPerson(personId);
        if (person == null) throw new EntityNotFoundException("Person", personId);
        person.setStatus(status);
        person.setUpdatedAt(LocalDateTime.now());
        updatePersonPort.updatePerson(person);
    }
}
