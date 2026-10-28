package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ManageGuardianDocumentUseCase;
import com.faceattend_edu.identity_service.application.port.out.GuardianDocumentStoragePort;
import com.faceattend_edu.identity_service.application.port.out.GuardianPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ForbiddenException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import com.faceattend_edu.identity_service.domain.model.GuardianDocumentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Guardian signed authorization")
class ManageGuardianDocumentUseCaseImplTest {

    private static final List<String> ADMIN = List.of("Administrador");
    private static final byte[] PDF = "%PDF-1.7 signed by the guardian".getBytes();

    @Mock GuardianPort guardianPort;
    @Mock GuardianDocumentStoragePort storage;
    @InjectMocks ManageGuardianDocumentUseCaseImpl useCase;

    private final UUID minor = UUID.randomUUID();
    private final UUID admin = UUID.randomUUID();
    private Guardian guardian;

    @BeforeEach
    void setUp() {
        guardian = new Guardian();
        guardian.setGuardianId(UUID.randomUUID());
        guardian.setMinorPersonId(minor);
        lenient().when(guardianPort.findActiveByMinor(minor)).thenReturn(Optional.of(guardian));
        lenient().when(guardianPort.save(any())).thenAnswer(call -> call.getArgument(0));
        lenient().when(storage.put(anyString(), any(), anyString())).thenAnswer(call -> "guardian-documents/" + call.getArgument(0));
    }

    @Test
    void theFileIsStoredUnderAGeneratedKeyAndDescribedOnTheGuardian() {
        Guardian saved = useCase.upload(minor, "C:\\scans\\firma \"madre\".pdf", PDF, admin, ADMIN);

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(storage).put(key.capture(), eq(PDF), eq("application/pdf"));
        assertThat(key.getValue()).contains(guardian.getGuardianId().toString()).endsWith(".pdf").doesNotContain("scans");
        assertThat(saved.hasConsentDocument()).isTrue();
        assertThat(saved.getConsentDocumentName()).isEqualTo("firma madre.pdf");
        assertThat(saved.getConsentDocumentMime()).isEqualTo("application/pdf");
        assertThat(saved.getConsentDocumentSize()).isEqualTo((long) PDF.length);
        assertThat(saved.getConsentDocumentUploadedAt()).isNotNull();
        assertThat(saved.getUpdatedBy()).isEqualTo(admin);
    }

    @Test
    void aNewFileReplacesTheOldOneAndRemovesItFromStorage() {
        guardian.setConsentDocumentUri("guardian-documents/old.pdf");

        useCase.upload(minor, null, PDF, admin, ADMIN);

        verify(storage).delete("guardian-documents/old.pdf");
    }

    @Test
    void aFailedReplacementCleanupDoesNotFailTheUpload() {
        guardian.setConsentDocumentUri("guardian-documents/old.pdf");
        doThrow(new GuardianDocumentStoragePort.StorageUnavailableException("down", new RuntimeException()))
                .when(storage).delete("guardian-documents/old.pdf");

        assertThat(useCase.upload(minor, "a.pdf", PDF, admin, ADMIN).hasConsentDocument()).isTrue();
    }

    @Test
    void ifTheRowCannotBeSavedTheStoredObjectIsRemoved() {
        when(guardianPort.save(any())).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> useCase.upload(minor, "a.pdf", PDF, admin, ADMIN)).isInstanceOf(IllegalStateException.class);

        verify(storage).delete(startsWithBucket());
    }

    @Test
    void onlyAdministratorsAuthenticatedUsersAndValidFilesAreAccepted() {
        assertThatThrownBy(() -> useCase.upload(minor, "a.pdf", PDF, admin, List.of("Aprendiz"))).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> useCase.upload(minor, "a.pdf", PDF, null, ADMIN)).isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> useCase.upload(minor, "a.pdf", new byte[0], admin, ADMIN)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> useCase.upload(minor, "a.pdf", "MZ-an-executable".getBytes(), admin, ADMIN))
                .isInstanceOf(ValidationException.class).hasMessageContaining("PDF, JPG or PNG");
        byte[] tooBig = new byte[(int) ManageGuardianDocumentUseCase.MAX_SIZE_BYTES + 1];
        System.arraycopy(PDF, 0, tooBig, 0, PDF.length);
        assertThatThrownBy(() -> useCase.upload(minor, "a.pdf", tooBig, admin, ADMIN)).hasMessageContaining("5 MB");
        verifyNoInteractions(storage);
        verify(guardianPort, never()).save(any());
    }

    @Test
    void thereMustBeAGuardianToAttachTheFileTo() {
        when(guardianPort.findActiveByMinor(minor)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.upload(minor, "a.pdf", PDF, admin, ADMIN)).isInstanceOf(EntityNotFoundException.class);
        verifyNoInteractions(storage);
    }

    @Test
    void theFileTypeComesFromItsBytesNotItsName() {
        byte[] png = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2};
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1};

        assertThat(useCase.upload(minor, "scan.pdf", png, admin, ADMIN).getConsentDocumentMime()).isEqualTo("image/png");
        assertThat(useCase.upload(minor, "scan.pdf", jpeg, admin, ADMIN).getConsentDocumentMime()).isEqualTo("image/jpeg");
        assertThat(GuardianDocumentType.detect(null)).isEmpty();
        assertThat(GuardianDocumentType.detect(new byte[] {0x25})).isEmpty();
    }

    @Test
    void anAdministratorDownloadsTheStoredFile() {
        guardian.setConsentDocumentUri("guardian-documents/a.pdf");
        guardian.setConsentDocumentName("autorizacion.pdf");
        guardian.setConsentDocumentMime("application/pdf");
        when(storage.get("guardian-documents/a.pdf")).thenReturn(Optional.of(PDF));

        ManageGuardianDocumentUseCase.Document document = useCase.download(minor, ADMIN);

        assertThat(document.content()).isEqualTo(PDF);
        assertThat(document.mimeType()).isEqualTo("application/pdf");
        assertThat(document.fileName()).isEqualTo("autorizacion.pdf");
    }

    @Test
    void downloadingWithoutAFileOrWithoutRoleFails() {
        assertThatThrownBy(() -> useCase.download(minor, ADMIN)).isInstanceOf(EntityNotFoundException.class);

        guardian.setConsentDocumentUri("guardian-documents/gone.pdf");
        when(storage.get("guardian-documents/gone.pdf")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> useCase.download(minor, ADMIN)).isInstanceOf(EntityNotFoundException.class);

        assertThatThrownBy(() -> useCase.download(minor, List.of("Instructor"))).isInstanceOf(ForbiddenException.class);
    }

    private static String startsWithBucket() {
        return org.mockito.ArgumentMatchers.startsWith("guardian-documents/");
    }
}
