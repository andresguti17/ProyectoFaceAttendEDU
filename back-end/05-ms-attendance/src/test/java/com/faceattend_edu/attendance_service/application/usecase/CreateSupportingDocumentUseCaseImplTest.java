package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.out.SupportingDocumentRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("IEEE 829 TC-05: Create Supporting Document Use Case Tests")
class CreateSupportingDocumentUseCaseImplTest {

    @Mock
    private SupportingDocumentRepository repository;
    @Mock
    private DomainEventPublisher eventPublisher;

    private CreateSupportingDocumentUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        useCase = new CreateSupportingDocumentUseCaseImpl(repository, eventPublisher);
    }

    private SupportingDocument validDocument() {
        SupportingDocument d = new SupportingDocument();
        d.setJustificationId(5L);
        d.setFileName("certificado.pdf");
        d.setStorageUri("s3://faceattend/justifications/certificado.pdf");
        d.setMimeType("application/pdf");
        d.setSizeBytes(2048L);
        return d;
    }

    @Nested
    @DisplayName("TC-05-CD01: Successful creation")
    class SuccessTests {

        @Test
        @DisplayName("Given valid document when create then saves, publishes and stamps audit fields")
        void givenValidDocument_whenCreate_thenReturnSavedAndPublishEvent() {
            // Arrange
            when(repository.save(any(SupportingDocument.class))).thenAnswer(call -> {
                SupportingDocument saved = call.getArgument(0);
                saved.setSupportingDocumentId(33L);
                return saved;
            });

            // Act
            SupportingDocument result = useCase.create(validDocument());

            // Assert
            assertEquals(33L, result.getSupportingDocumentId());
            assertEquals(5L, result.getJustificationId());
            assertNotNull(result.getCreatedAt());
            assertEquals(1L, result.getRowVersion());
            verify(repository).save(any(SupportingDocument.class));
            verify(eventPublisher).publish(eq("document-events"), anyString());
        }
    }

    @Nested
    @DisplayName("TC-05-CD03: Accepted formats and size limit (ERF 6.1)")
    class AcceptedFormatTests {

        @ParameterizedTest
        @ValueSource(strings = {"application/pdf", "image/jpeg", "image/png", "IMAGE/PNG"})
        @DisplayName("Given an accepted mime type of exactly 5 MB when create then it is saved")
        void givenAcceptedMimeTypeAtTheLimit_whenCreate_thenSave(String mimeType) {
            // Arrange
            SupportingDocument doc = validDocument();
            doc.setMimeType(mimeType);
            doc.setSizeBytes(5L * 1024 * 1024);
            when(repository.save(any(SupportingDocument.class))).thenAnswer(call -> call.getArgument(0));

            // Act
            SupportingDocument result = useCase.create(doc);

            // Assert
            assertEquals(mimeType, result.getMimeType());
            verify(repository).save(doc);
        }
    }

    @Nested
    @DisplayName("TC-05-CD02: Validation before persistence")
    class ValidationTests {

        @Test
        @DisplayName("Given null sizeBytes when create then IllegalArgumentException without save nor publish")
        void givenNullSizeBytes_whenCreate_thenThrowAndNeverPersist() {
            // Arrange
            SupportingDocument doc = validDocument();
            doc.setSizeBytes(null);

            // Act & Assert
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> useCase.create(doc));
            assertEquals("sizeBytes must be > 0", ex.getMessage());
            verify(repository, never()).save(any());
            verifyNoInteractions(eventPublisher);
        }

        @Test
        @DisplayName("Given zero sizeBytes when create then IllegalArgumentException without save nor publish")
        void givenZeroSizeBytes_whenCreate_thenThrowAndNeverPersist() {
            // Arrange
            SupportingDocument doc = validDocument();
            doc.setSizeBytes(0L);

            // Act & Assert
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> useCase.create(doc));
            assertEquals("sizeBytes must be > 0", ex.getMessage());
            verify(repository, never()).save(any());
            verifyNoInteractions(eventPublisher);
        }

        @Test
        @DisplayName("Given negative sizeBytes when create then IllegalArgumentException without save nor publish")
        void givenNegativeSizeBytes_whenCreate_thenThrowAndNeverPersist() {
            // Arrange
            SupportingDocument doc = validDocument();
            doc.setSizeBytes(-5L);

            // Act & Assert
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> useCase.create(doc));
            assertEquals("sizeBytes must be > 0", ex.getMessage());
            verify(repository, never()).save(any());
            verifyNoInteractions(eventPublisher);
        }

        @Test
        @DisplayName("Given a DOCX when create then IllegalArgumentException without save nor publish")
        void givenUnsupportedMimeType_whenCreate_thenThrowAndNeverPersist() {
            // Arrange
            SupportingDocument doc = validDocument();
            doc.setMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");

            // Act & Assert
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> useCase.create(doc));
            assertEquals("mimeType must be one of application/pdf, image/jpeg, image/png", ex.getMessage());
            verify(repository, never()).save(any());
            verifyNoInteractions(eventPublisher);
        }

        @Test
        @DisplayName("Given a document over 5 MB when create then IllegalArgumentException without save nor publish")
        void givenSizeOverFiveMegabytes_whenCreate_thenThrowAndNeverPersist() {
            // Arrange
            SupportingDocument doc = validDocument();
            doc.setSizeBytes(5L * 1024 * 1024 + 1);

            // Act & Assert
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> useCase.create(doc));
            assertEquals("sizeBytes must be <= 5242880 (5 MB)", ex.getMessage());
            verify(repository, never()).save(any());
            verifyNoInteractions(eventPublisher);
        }

        @Test
        @DisplayName("Given blank fileName when create then IllegalArgumentException without save nor publish")
        void givenBlankFileName_whenCreate_thenThrowAndNeverPersist() {
            // Arrange
            SupportingDocument doc = validDocument();
            doc.setFileName("   ");

            // Act & Assert
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> useCase.create(doc));
            assertEquals("fileName is required", ex.getMessage());
            verify(repository, never()).save(any());
            verifyNoInteractions(eventPublisher);
        }

        @Test
        @DisplayName("Given null justificationId when create then IllegalArgumentException without save nor publish")
        void givenNullJustificationId_whenCreate_thenThrowAndNeverPersist() {
            // Arrange
            SupportingDocument doc = validDocument();
            doc.setJustificationId(null);

            // Act & Assert
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> useCase.create(doc));
            assertEquals("justificationId is required", ex.getMessage());
            verify(repository, never()).save(any());
            verifyNoInteractions(eventPublisher);
        }
    }
}
