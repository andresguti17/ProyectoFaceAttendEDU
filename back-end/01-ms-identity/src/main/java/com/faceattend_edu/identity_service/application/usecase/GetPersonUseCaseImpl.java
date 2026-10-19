package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.GetPersonUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.Person;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@RequiredArgsConstructor
@Service
public class GetPersonUseCaseImpl implements GetPersonUseCase {

    private final LoadPersonPort loadPersonPort;

    @Override
    public Person getPerson(UUID personId) {
        Person person = loadPersonPort.loadPerson(personId);
        if (person == null) throw new EntityNotFoundException("Person", personId);
        return person;
    }
}
