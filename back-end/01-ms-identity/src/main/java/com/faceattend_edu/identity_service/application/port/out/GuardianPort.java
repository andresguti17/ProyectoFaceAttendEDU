package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.Guardian;

import java.util.Optional;
import java.util.UUID;

public interface GuardianPort {

    Guardian save(Guardian guardian);

    /** The active guardian of the minor, if any. */
    Optional<Guardian> findActiveByMinor(UUID minorPersonId);

    /** Soft-deletes the guardian (replaced by another one). */
    void remove(UUID guardianId, UUID deletedBy);
}
