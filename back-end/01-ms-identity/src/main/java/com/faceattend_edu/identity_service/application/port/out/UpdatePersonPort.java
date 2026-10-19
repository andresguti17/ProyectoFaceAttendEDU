package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.Person;

public interface UpdatePersonPort {
    void updatePerson(Person person);
}
