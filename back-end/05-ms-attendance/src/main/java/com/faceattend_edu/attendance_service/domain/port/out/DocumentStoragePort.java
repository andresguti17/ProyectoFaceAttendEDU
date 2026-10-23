package com.faceattend_edu.attendance_service.domain.port.out;

import java.util.Optional;

/** Object storage for justification supporting documents (MinIO, ADR-009). */
public interface DocumentStoragePort {

    /** Stores the bytes under {@code objectKey} and returns the storage URI saved in the database. */
    String put(String objectKey, byte[] content, String contentType);

    /** The bytes behind a storage URI, or empty when no object exists there (e.g. legacy rows). */
    Optional<byte[]> get(String storageUri);

    /** Removes the object behind a storage URI; a missing object is not an error. */
    void delete(String storageUri);
}
