package com.faceattend_edu.attendance_service.infrastructure.storage;

import com.faceattend_edu.attendance_service.domain.port.out.DocumentStoragePort;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.ServerSideEncryptionS3;
import io.minio.errors.ErrorResponseException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Optional;

/**
 * Supporting documents in MinIO (ADR-009). Every object is written with SSE-S3, so
 * MinIO encrypts it at rest with the key from MINIO_KMS_SECRET_KEY (ADR-016). The
 * storage URI saved in the database is {@code <bucket>/<objectKey>}.
 */
@Component
public class MinioDocumentStorageAdapter implements DocumentStoragePort {

    private final MinioClient client;
    private final String bucket;
    private volatile boolean bucketReady;

    public MinioDocumentStorageAdapter(
            @Value("${faceattend.storage.endpoint:http://localhost:9000}") String endpoint,
            @Value("${faceattend.storage.access-key:}") String accessKey,
            @Value("${faceattend.storage.secret-key:}") String secretKey,
            @Value("${faceattend.storage.bucket:justification-documents}") String bucket) {
        this.client = MinioClient.builder().endpoint(endpoint).credentials(accessKey, secretKey).build();
        this.bucket = bucket;
    }

    @Override
    public String put(String objectKey, byte[] content, String contentType) {
        ensureBucket();
        try (InputStream in = new ByteArrayInputStream(content)) {
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(in, content.length, -1)
                    .contentType(contentType)
                    .sse(new ServerSideEncryptionS3())
                    .build());
        } catch (Exception e) {
            throw new StorageUnavailableException("Cannot store the supporting document", e);
        }
        return bucket + "/" + objectKey;
    }

    @Override
    public Optional<byte[]> get(String storageUri) {
        String key = objectKey(storageUri);
        if (key == null) return Optional.empty();
        try (InputStream in = client.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build())) {
            return Optional.of(in.readAllBytes());
        } catch (ErrorResponseException e) {
            String code = e.errorResponse().code();
            if ("NoSuchKey".equals(code) || "NoSuchBucket".equals(code)) return Optional.empty();
            throw new StorageUnavailableException("Cannot read the supporting document", e);
        } catch (Exception e) {
            throw new StorageUnavailableException("Cannot read the supporting document", e);
        }
    }

    @Override
    public void delete(String storageUri) {
        String key = objectKey(storageUri);
        if (key == null) return;
        try {
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception e) {
            throw new StorageUnavailableException("Cannot delete the supporting document", e);
        }
    }

    /** Only URIs inside this service's bucket map to an object; anything else is a legacy path. */
    private String objectKey(String storageUri) {
        String prefix = bucket + "/";
        if (storageUri == null || !storageUri.startsWith(prefix) || storageUri.contains("..")) return null;
        String key = storageUri.substring(prefix.length());
        return key.isBlank() ? null : key;
    }

    private void ensureBucket() {
        if (bucketReady) return;
        try {
            if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
            bucketReady = true;
        } catch (ErrorResponseException e) {
            if (!"BucketAlreadyOwnedByYou".equals(e.errorResponse().code())) {
                throw new StorageUnavailableException("Cannot prepare the document bucket", e);
            }
            bucketReady = true;
        } catch (Exception e) {
            throw new StorageUnavailableException("Cannot prepare the document bucket", e);
        }
    }

    /** Object storage is down or misconfigured: answered as 503, never as a client error. */
    public static class StorageUnavailableException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public StorageUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
