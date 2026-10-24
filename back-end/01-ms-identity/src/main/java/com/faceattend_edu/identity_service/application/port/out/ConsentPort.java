package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.DataProcessingConsent;

import java.util.Optional;
import java.util.UUID;

public interface ConsentPort {

    DataProcessingConsent save(DataProcessingConsent consent);

    /** The most recent acceptance of the person, if any. */
    Optional<DataProcessingConsent> findCurrent(UUID personId);
}
