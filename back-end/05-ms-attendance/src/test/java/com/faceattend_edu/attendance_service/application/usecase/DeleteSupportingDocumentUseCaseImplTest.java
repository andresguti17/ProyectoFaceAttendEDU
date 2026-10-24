package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.out.DocumentStoragePort;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeleteSupportingDocumentUseCaseImplTest {

    @Mock SupportingDocumentRepository repository;
    @Mock DocumentStoragePort storage;
    @InjectMocks DeleteSupportingDocumentUseCaseImpl useCase;

    private SupportingDocument stored() {
        SupportingDocument d = new SupportingDocument();
        d.setSupportingDocumentId(3L);
        d.setStorageUri("justification-documents/2026/10/a.pdf");
        return d;
    }

    @Test
    void deletingADocumentAlsoRemovesItsObject() {
        when(repository.findById(3L)).thenReturn(Optional.of(stored()));

        useCase.delete(3L);

        verify(repository).deleteById(3L);
        verify(storage).delete("justification-documents/2026/10/a.pdf");
    }

    @Test
    void aStorageFailureDoesNotUndoTheDeletion() {
        when(repository.findById(3L)).thenReturn(Optional.of(stored()));
        doThrow(new RuntimeException("minio down")).when(storage).delete(anyString());

        assertThatCode(() -> useCase.delete(3L)).doesNotThrowAnyException();
        verify(repository).deleteById(3L);
    }

    @Test
    void anUnknownDocumentIsNotFound() {
        when(repository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.delete(9L)).isInstanceOf(EntityNotFoundException.class);
        verify(storage, never()).delete(anyString());
    }
}
