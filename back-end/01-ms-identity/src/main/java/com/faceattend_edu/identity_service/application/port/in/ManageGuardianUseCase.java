package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.Guardian;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

/** Registration of the guardian of a minor learner. Only school administrators. */
public interface ManageGuardianUseCase {

    record GuardianData(String fullName, String documentType, String documentNumber, String email,
                        String phone, String relationship) {}

    Optional<Guardian> find(UUID minorPersonId, Collection<String> callerRoles);

    /** Registers and links the guardian to the minor; fails when one is already linked. */
    Guardian register(UUID minorPersonId, GuardianData data, UUID callerUserId, Collection<String> callerRoles, String bearer);

    /** Edits the linked guardian; a different document replaces the guardian (the old one is retired). */
    Guardian update(UUID minorPersonId, GuardianData data, UUID callerUserId, Collection<String> callerRoles, String bearer);
}
