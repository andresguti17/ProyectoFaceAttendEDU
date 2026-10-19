package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.CreatePersonUseCase;
import com.faceattend_edu.identity_service.application.port.out.SavePersonPort;
import com.faceattend_edu.identity_service.domain.model.Person;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@RequiredArgsConstructor
@Service
public class CreatePersonUseCaseImpl implements CreatePersonUseCase {

    private final SavePersonPort savePersonPort;

    @Override
    public Person createPerson(Person person) {
        person.validate();
        person.setStatus(true);
        person.setCreatedAt(LocalDateTime.now());
        return savePersonPort.savePerson(person);
    }
}
