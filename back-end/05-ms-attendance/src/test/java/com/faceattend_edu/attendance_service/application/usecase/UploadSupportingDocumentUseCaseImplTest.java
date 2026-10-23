package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocumentType;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.out.DocumentStoragePort;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("IEEE 829 TC-05: supporting document upload to object storage")
class UploadSupportingDocumentUseCaseImplTest {

    private static final byte[] PDF = "%PDF-1.7\n1 0 obj".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00};

    @Mock GetJustificationUseCase justificationUseCase;
    @Mock SupportingDocumentRepository repository;
    @Mock DocumentStoragePort storage;
    @Mock DomainEventPublisher eventPublisher;
    @InjectMocks UploadSupportingDocumentUseCaseImpl useCase;

    @Test
    @DisplayName("A PDF is stored under a server-generated key and recorded with the detected type")
    void storesPdfAndRecordsIt() {
        when(justificationUseCase.getById(4L)).thenReturn(new Justification());
        when(storage.put(anyString(), eq(PDF), eq("application/pdf")))
                .thenAnswer(call -> "justification-documents/" + call.getArgument(0));
        when(repository.save(any(SupportingDocument.class))).thenAnswer(call -> {
            SupportingDocument d = call.getArgument(0);
            d.setSupportingDocumentId(10L);
            return d;
        });

        SupportingDocument saved = useCase.upload(4L, "../../etc/incapacidad.pdf", PDF);

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(storage).put(key.capture(), eq(PDF), eq("application/pdf"));
        assertThat(key.getValue()).matches("\\d{4}/\\d{2}/[0-9a-f-]{36}\\.pdf");
        assertThat(saved.getStorageUri()).isEqualTo("justification-documents/" + key.getValue());
        assertThat(saved.getFileName()).isEqualTo("incapacidad.pdf");
        assertThat(saved.getMimeType()).isEqualTo("application/pdf");
        assertThat(saved.getSizeBytes()).isEqualTo(PDF.length);
        verify(eventPublisher).publish(eq("document-events"), anyString());
    }

    @Test
    @DisplayName("The type comes from the bytes: a PNG renamed to .pdf is stored as image/png")
    void typeComesFromContentNotName() {
        when(justificationUseCase.getById(4L)).thenReturn(new Justification());
        when(storage.put(anyString(), eq(PNG), eq("image/png"))).thenReturn("justification-documents/k.png");
        when(repository.save(any(SupportingDocument.class))).thenAnswer(call -> call.getArgument(0));

        assertThat(useCase.upload(4L, "foto.pdf", PNG).getMimeType()).isEqualTo("image/png");
    }

    @Test
    @DisplayName("A file that is not PDF, JPG or PNG is rejected before touching storage")
    void rejectsUnknownContent() {
        byte[] exe = "MZ\u0090\u0000 fake executable".getBytes(StandardCharsets.ISO_8859_1);

        assertThatThrownBy(() -> useCase.upload(4L, "soporte.pdf", exe))
                .isInstanceOf(ValidationException.class);
        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    @DisplayName("Files over 5 MB and empty files are rejected")
    void rejectsSize() {
        byte[] big = Arrays.copyOf(PDF, (int) UploadSupportingDocumentUseCaseImpl.MAX_SIZE_BYTES + 1);

        assertThatThrownBy(() -> useCase.upload(4L, "big.pdf", big)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> useCase.upload(4L, "empty.pdf", new byte[0])).isInstanceOf(ValidationException.class);
        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    @DisplayName("An unknown justification answers 404 and nothing is stored")
    void unknownJustification() {
        when(justificationUseCase.getById(99L)).thenThrow(new EntityNotFoundException("Justification", 99L));

        assertThatThrownBy(() -> useCase.upload(99L, "a.pdf", PDF)).isInstanceOf(EntityNotFoundException.class);
        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    @DisplayName("If the row cannot be saved, the stored object is removed (no orphans)")
    void compensatesWhenSaveFails() {
        when(justificationUseCase.getById(4L)).thenReturn(new Justification());
        when(storage.put(anyString(), eq(PDF), eq("application/pdf"))).thenReturn("justification-documents/x.pdf");
        when(repository.save(any(SupportingDocument.class))).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> useCase.upload(4L, "a.pdf", PDF)).isInstanceOf(IllegalStateException.class);
        verify(storage).delete("justification-documents/x.pdf");
        verify(eventPublisher, never()).publish(anyString(), anyString());
    }

    @Test
    @DisplayName("Magic bytes: PDF, PNG and JPEG are recognised, anything else is not")
    void detectsTypes() {
        assertThat(SupportingDocumentType.detect(PDF)).contains(SupportingDocumentType.PDF);
        assertThat(SupportingDocumentType.detect(PNG)).contains(SupportingDocumentType.PNG);
        assertThat(SupportingDocumentType.detect(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00}))
                .contains(SupportingDocumentType.JPEG);
        assertThat(SupportingDocumentType.detect("GIF89a".getBytes(StandardCharsets.US_ASCII))).isEmpty();
        assertThat(SupportingDocumentType.detect(new byte[]{0x25})).isEmpty();
    }
}
