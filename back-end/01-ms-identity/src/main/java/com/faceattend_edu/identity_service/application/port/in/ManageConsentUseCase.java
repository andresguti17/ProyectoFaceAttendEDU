package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.DataProcessingConsent;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

/** Data-processing authorization of a person (Ley 1581 de 2012). */
public interface ManageConsentUseCase {

    /** Version of the privacy notice in force. */
    String currentPolicyVersion();

    Optional<DataProcessingConsent> current(UUID personId, UUID callerUserId, Collection<String> callerRoles);

    /**
     * Records an acceptance of the notice in force. The holder records their own ("self");
     * an administrator records it for someone present ("assisted").
     */
    DataProcessingConsent accept(UUID personId, String policyVersion, boolean biometricAccepted,
                                 UUID callerUserId, Collection<String> callerRoles);

    /** Withdraws the authorization to process biometric data (art. 8-e). */
    DataProcessingConsent revokeBiometric(UUID personId, UUID callerUserId, Collection<String> callerRoles);

    /** Used by the public school sign-up: the administrator accepts for themself. */
    DataProcessingConsent recordSelf(UUID personId, String policyVersion, boolean biometricAccepted);

    /** Used by account provisioning: the administrator registers the holder's acceptance. */
    DataProcessingConsent recordAssisted(UUID personId, String policyVersion, boolean biometricAccepted, UUID recordedBy);
}
