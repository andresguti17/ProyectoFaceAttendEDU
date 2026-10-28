package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.TermsAcceptance;

import java.util.Optional;
import java.util.UUID;

public interface TermsAcceptancePort {

    TermsAcceptance save(TermsAcceptance acceptance);

    /** The most recent acceptance of the person, if any. */
    Optional<TermsAcceptance> findCurrent(UUID personId);
}
