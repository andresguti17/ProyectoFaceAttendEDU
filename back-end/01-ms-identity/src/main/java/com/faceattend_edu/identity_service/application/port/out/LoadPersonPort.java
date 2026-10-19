package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.Person;
import java.util.UUID;

public interface LoadPersonPort {
    Person loadPerson(UUID personId);
}
