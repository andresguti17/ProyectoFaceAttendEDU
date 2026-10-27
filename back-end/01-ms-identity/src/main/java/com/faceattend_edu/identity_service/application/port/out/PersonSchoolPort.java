package com.faceattend_edu.identity_service.application.port.out;

import java.util.Optional;
import java.util.UUID;

/** School (sede) a person belongs to, resolved in the academic service. */
public interface PersonSchoolPort {

    /** @param bearer session of the caller, whose scope academic applies. */
    Optional<Long> schoolOf(String bearer, UUID personId);
}
