package com.faceattend_edu.identity_service.application.port.out;

import java.util.UUID;

/** Hard-deletes the user and person rows of a provisioning that could not be completed. */
public interface RemoveIdentityPort {

    /** {@code userId} may be null when only the person had been created. */
    void removeUserAndPerson(UUID userId, UUID personId);
}
