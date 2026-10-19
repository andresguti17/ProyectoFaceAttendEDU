package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.Person;

import java.util.UUID;

public interface UpdatePersonUseCase {
    void updatePerson(UUID personId, Person person);
}
