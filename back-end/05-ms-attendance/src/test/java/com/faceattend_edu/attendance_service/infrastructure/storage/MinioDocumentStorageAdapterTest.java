package com.faceattend_edu.attendance_service.infrastructure.storage;

import com.faceattend_edu.attendance_service.infrastructure.storage.MinioDocumentStorageAdapter.StorageUnavailableException;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@DisplayName("MinIO storage of supporting documents")
class MinioDocumentStorageAdapterTest {

    private MinioClient client;
    private MinioDocumentStorageAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new MinioDocumentStorageAdapter("http://minio:9000", "key", "secret", "justification-documents");
        client = mock(MinioClient.class);
        ReflectionTestUtils.setField(adapter, "client", client);
    }

    private static ErrorResponseException minioError(String code) {
        ErrorResponseException error = mock(ErrorResponseException.class);
        ErrorResponse response = mock(ErrorResponse.class);
        when(response.code()).thenReturn(code);
        when(error.errorResponse()).thenReturn(response);
        return error;
    }

    @Test
    void createsTheBucketOnceAndStoresEveryObjectEncrypted() throws Exception {
        when(client.bucketExists(any(BucketExistsArgs.class))).thenReturn(false);
        String uri = adapter.put("2026/10/a.pdf", new byte[] {1, 2, 3}, "application/pdf");
        adapter.put("2026/10/b.pdf", new byte[] {4}, "application/pdf");

        assertThat(uri).isEqualTo("justification-documents/2026/10/a.pdf");
        verify(client, times(1)).makeBucket(any(MakeBucketArgs.class));
        ArgumentCaptor<PutObjectArgs> put = ArgumentCaptor.forClass(PutObjectArgs.class);
        verify(client, times(2)).putObject(put.capture());
        assertThat(put.getAllValues().get(0).sse()).isNotNull();
        assertThat(put.getAllValues().get(0).object()).isEqualTo("2026/10/a.pdf");
        assertThat(put.getAllValues().get(0).contentType()).isEqualTo("application/pdf");
    }

    @Test
    void aBucketCreatedByAnotherReplicaIsFineButOtherFailuresAre503() throws Exception {
        when(client.bucketExists(any(BucketExistsArgs.class))).thenReturn(false);
        ErrorResponseException owned = minioError("BucketAlreadyOwnedByYou");
        org.mockito.Mockito.doThrow(owned).when(client).makeBucket(any(MakeBucketArgs.class));
        assertThat(adapter.put("k.pdf", new byte[] {1}, "application/pdf")).endsWith("/k.pdf");

        MinioDocumentStorageAdapter fresh = new MinioDocumentStorageAdapter("http://minio:9000", "key", "secret", "docs");
        MinioClient down = mock(MinioClient.class);
        ReflectionTestUtils.setField(fresh, "client", down);
        when(down.bucketExists(any(BucketExistsArgs.class))).thenThrow(new IOException("connection refused"));
        assertThatThrownBy(() -> fresh.put("k.pdf", new byte[] {1}, "application/pdf"))
                .isInstanceOf(StorageUnavailableException.class).hasMessageContaining("bucket");

        MinioClient denied = mock(MinioClient.class);
        ReflectionTestUtils.setField(fresh, "client", denied);
        ErrorResponseException accessDenied = minioError("AccessDenied");
        when(denied.bucketExists(any(BucketExistsArgs.class))).thenThrow(accessDenied);
        assertThatThrownBy(() -> fresh.put("k.pdf", new byte[] {1}, "application/pdf")).isInstanceOf(StorageUnavailableException.class);
    }

    @Test
    void aFailedUploadIs503() throws Exception {
        when(client.bucketExists(any(BucketExistsArgs.class))).thenReturn(true);
        when(client.putObject(any(PutObjectArgs.class))).thenThrow(new IOException("disk full"));
        assertThatThrownBy(() -> adapter.put("k.pdf", new byte[] {1}, "application/pdf"))
                .isInstanceOf(StorageUnavailableException.class).hasMessage("Cannot store the supporting document");
    }

    @Test
    void readsOnlyObjectsInsideItsBucket() throws Exception {
        assertThat(adapter.get("justification-documents/../secrets")).isEmpty();
        assertThat(adapter.get("other-bucket/a.pdf")).isEmpty();
        assertThat(adapter.get("justification-documents/")).isEmpty();
        assertThat(adapter.get(null)).isEmpty();
        verifyNoInteractions(client);

        GetObjectResponse body = new GetObjectResponse(Headers.of(), "justification-documents", "", "a.pdf", new ByteArrayInputStream(new byte[] {9, 8}));
        when(client.getObject(any(GetObjectArgs.class))).thenReturn(body);
        assertThat(adapter.get("justification-documents/a.pdf")).contains(new byte[] {9, 8});
    }

    @Test
    void aMissingObjectIsEmptyAndAnyOtherReadFailureIs503() throws Exception {
        ErrorResponseException missing = minioError("NoSuchKey");
        when(client.getObject(any(GetObjectArgs.class))).thenThrow(missing);
        assertThat(adapter.get("justification-documents/a.pdf")).isEmpty();

        MinioClient other = mock(MinioClient.class);
        ReflectionTestUtils.setField(adapter, "client", other);
        ErrorResponseException denied = minioError("AccessDenied");
        when(other.getObject(any(GetObjectArgs.class))).thenThrow(denied);
        assertThatThrownBy(() -> adapter.get("justification-documents/a.pdf")).isInstanceOf(StorageUnavailableException.class);

        MinioClient broken = mock(MinioClient.class);
        ReflectionTestUtils.setField(adapter, "client", broken);
        when(broken.getObject(any(GetObjectArgs.class))).thenThrow(new IOException("reset"));
        assertThatThrownBy(() -> adapter.get("justification-documents/a.pdf")).isInstanceOf(StorageUnavailableException.class);
    }

    @Test
    void deletesOnlyOwnObjectsAndReportsFailures() throws Exception {
        adapter.delete("legacy/path.pdf");
        verify(client, never()).removeObject(any(RemoveObjectArgs.class));
        adapter.delete("justification-documents/a.pdf");
        verify(client).removeObject(any(RemoveObjectArgs.class));

        org.mockito.Mockito.doThrow(new IOException("down")).when(client).removeObject(any(RemoveObjectArgs.class));
        assertThatThrownBy(() -> adapter.delete("justification-documents/a.pdf")).isInstanceOf(StorageUnavailableException.class);
    }
}
