package com.faceattend_edu.identity_service.adapter.out.storage;

import com.faceattend_edu.identity_service.application.port.out.GuardianDocumentStoragePort.StorageUnavailableException;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.errors.ErrorResponseException;
import io.minio.messages.ErrorResponse;
import okhttp3.Headers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("MinIO storage of the guardian's signed authorization")
class MinioGuardianDocumentStorageAdapterTest {

    private static final String BUCKET = "guardian-documents";

    private MinioClient client;
    private MinioGuardianDocumentStorageAdapter adapter;

    @BeforeEach
    void setUp() {
        client = mock(MinioClient.class);
        adapter = adapterOver(client);
    }

    private static MinioGuardianDocumentStorageAdapter adapterOver(MinioClient client) {
        MinioGuardianDocumentStorageAdapter adapter =
                new MinioGuardianDocumentStorageAdapter("http://minio:9000", "key", "secret", BUCKET);
        ReflectionTestUtils.setField(adapter, "client", client);
        return adapter;
    }

    private static ErrorResponseException minioError(String code) {
        ErrorResponseException error = mock(ErrorResponseException.class);
        ErrorResponse response = mock(ErrorResponse.class);
        when(response.code()).thenReturn(code);
        when(error.errorResponse()).thenReturn(response);
        return error;
    }

    @Test
    void createsTheBucketOnceAndEncryptsEveryObject() throws Exception {
        when(client.bucketExists(any(BucketExistsArgs.class))).thenReturn(false);

        String uri = adapter.put("2026/10/g/a.pdf", new byte[] {1, 2}, "application/pdf");
        adapter.put("2026/10/g/b.pdf", new byte[] {3}, "application/pdf");

        assertThat(uri).isEqualTo(BUCKET + "/2026/10/g/a.pdf");
        verify(client, times(1)).makeBucket(any(MakeBucketArgs.class));
        ArgumentCaptor<PutObjectArgs> put = ArgumentCaptor.forClass(PutObjectArgs.class);
        verify(client, times(2)).putObject(put.capture());
        assertThat(put.getAllValues().get(0).sse()).isNotNull();
        assertThat(put.getAllValues().get(0).contentType()).isEqualTo("application/pdf");
    }

    @Test
    void storageProblemsAreReportedAsUnavailableNeverAsClientErrors() throws Exception {
        // bucket owned by another replica: fine
        when(client.bucketExists(any(BucketExistsArgs.class))).thenReturn(false);
        ErrorResponseException owned = minioError("BucketAlreadyOwnedByYou");
        doThrow(owned).when(client).makeBucket(any(MakeBucketArgs.class));
        assertThat(adapter.put("k.pdf", new byte[] {1}, "application/pdf")).endsWith("/k.pdf");

        // any other bucket problem, an unreachable server and a failed upload: 503
        MinioClient denied = mock(MinioClient.class);
        ErrorResponseException accessDenied = minioError("AccessDenied");
        when(denied.bucketExists(any(BucketExistsArgs.class))).thenThrow(accessDenied);
        assertThatThrownBy(() -> adapterOver(denied).put("k.pdf", new byte[] {1}, "application/pdf"))
                .isInstanceOf(StorageUnavailableException.class);
        MinioClient down = mock(MinioClient.class);
        when(down.bucketExists(any(BucketExistsArgs.class))).thenThrow(new IOException("refused"));
        assertThatThrownBy(() -> adapterOver(down).put("k.pdf", new byte[] {1}, "application/pdf"))
                .isInstanceOf(StorageUnavailableException.class).hasMessageContaining("bucket");
        MinioClient full = mock(MinioClient.class);
        when(full.bucketExists(any(BucketExistsArgs.class))).thenReturn(true);
        when(full.putObject(any(PutObjectArgs.class))).thenThrow(new IOException("disk full"));
        assertThatThrownBy(() -> adapterOver(full).put("k.pdf", new byte[] {1}, "application/pdf"))
                .isInstanceOf(StorageUnavailableException.class).hasMessageContaining("store");
    }

    @Test
    void readsOnlyObjectsInsideItsOwnBucket() throws Exception {
        for (String foreign : new String[] {BUCKET + "/../secrets", "other/a.pdf", BUCKET + "/", null}) {
            assertThat(adapter.get(foreign)).isEmpty();
        }
        GetObjectResponse body = new GetObjectResponse(Headers.of(), BUCKET, "", "a.pdf", new ByteArrayInputStream(new byte[] {9, 8}));
        when(client.getObject(any(GetObjectArgs.class))).thenReturn(body);

        assertThat(adapter.get(BUCKET + "/a.pdf")).contains(new byte[] {9, 8});
    }

    @Test
    void aMissingObjectIsEmptyButOtherReadFailuresAreUnavailable() throws Exception {
        ErrorResponseException missing = minioError("NoSuchKey");
        when(client.getObject(any(GetObjectArgs.class))).thenThrow(missing);
        assertThat(adapter.get(BUCKET + "/a.pdf")).isEmpty();

        MinioClient denied = mock(MinioClient.class);
        ErrorResponseException readDenied = minioError("AccessDenied");
        when(denied.getObject(any(GetObjectArgs.class))).thenThrow(readDenied);
        assertThatThrownBy(() -> adapterOver(denied).get(BUCKET + "/a.pdf")).isInstanceOf(StorageUnavailableException.class);
        MinioClient reset = mock(MinioClient.class);
        when(reset.getObject(any(GetObjectArgs.class))).thenThrow(new IOException("reset"));
        assertThatThrownBy(() -> adapterOver(reset).get(BUCKET + "/a.pdf")).isInstanceOf(StorageUnavailableException.class);
    }

    @Test
    void deletesOnlyItsOwnObjectsAndReportsFailures() throws Exception {
        adapter.delete("legacy/path.pdf");
        verify(client, never()).removeObject(any(RemoveObjectArgs.class));

        adapter.delete(BUCKET + "/a.pdf");
        verify(client).removeObject(any(RemoveObjectArgs.class));

        doThrow(new IOException("down")).when(client).removeObject(any(RemoveObjectArgs.class));
        assertThatThrownBy(() -> adapter.delete(BUCKET + "/a.pdf")).isInstanceOf(StorageUnavailableException.class);
    }
}
