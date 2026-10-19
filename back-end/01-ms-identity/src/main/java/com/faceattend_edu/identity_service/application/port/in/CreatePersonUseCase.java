package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.Person;

public interface CreatePersonUseCase {
    Person createPerson(Person person);
}
