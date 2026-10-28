package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.Enablement;

import java.util.Collection;
import java.util.UUID;

/** Acceptance of the Terms and Conditions and the resulting enablement of the person. */
public interface ManageTermsUseCase {

    String currentTermsVersion();

    Enablement enablement(UUID personId, UUID callerUserId);

    /**
     * An adult accepts for themself. A minor cannot: the school administrator records the acceptance
     * of the guardian, who must be present, once the guardian is registered.
     */
    Enablement accept(UUID personId, String termsVersion, UUID callerUserId, Collection<String> callerRoles, String bearer);
}
