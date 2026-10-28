package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.Guardian;

import java.util.Collection;
import java.util.UUID;

/**
 * The guardian's signed authorization (Ley 1581 art. 7): the school administrator uploads the file the
 * guardian signed at the school. A minor is not enabled for biometric features without it.
 */
public interface ManageGuardianDocumentUseCase {

    long MAX_SIZE_BYTES = 5L * 1024 * 1024;

    record Document(String fileName, String mimeType, byte[] content) {}

    /** Stores the file for the minor's active guardian, replacing a previous one. PDF, JPG or PNG up to 5 MB. */
    Guardian upload(UUID minorPersonId, String originalFileName, byte[] content, UUID callerUserId,
                    Collection<String> callerRoles);

    Document download(UUID minorPersonId, Collection<String> callerRoles);
}
