package com.faceattend_edu.identity_service.application.port.out;

import java.util.Optional;

/** Object storage for the guardian's signed authorization (MinIO, ADR-009). */
public interface GuardianDocumentStoragePort {

    /** Stores the file under {@code objectKey} and returns the storage URI to keep in the database. */
    String put(String objectKey, byte[] content, String contentType);

    Optional<byte[]> get(String storageUri);

    void delete(String storageUri);

    /** Object storage is down or misconfigured: answered as 503, never as a client error. */
    class StorageUnavailableException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public StorageUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
