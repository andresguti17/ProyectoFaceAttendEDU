package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.port.out.JustificationTypeRepository;
import com.faceattend_edu.attendance_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

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
@DisplayName("IEEE 829 TC-05: Create Justification Type Use Case Tests")
class CreateJustificationTypeUseCaseImplTest {

    @Mock
    private JustificationTypeRepository repository;
    @Mock
    private DomainEventPublisher eventPublisher;

    private CreateJustificationTypeUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        useCase = new CreateJustificationTypeUseCaseImpl(repository, eventPublisher);
    }

    private JustificationType type(Integer schoolId, String name) {
        JustificationType t = new JustificationType();
        t.setSchoolId(schoolId);
        t.setName(name);
        return t;
    }

    @Nested
    @DisplayName("TC-05-CJ01: Successful creation")
    class SuccessTests {

        @Test
        @DisplayName("Given global type when create then saves, publishes and stamps audit fields")
        void givenGlobalType_whenCreate_thenReturnSavedAndPublishEvent() {
            // Arrange
            when(repository.findByNameAndSchoolIdIsNull("Medical leave")).thenReturn(Optional.empty());
            when(repository.save(any(JustificationType.class))).thenAnswer(call -> {
                JustificationType saved = call.getArgument(0);
                saved.setJustificationTypeId(7);
                return saved;
            });

            // Act
            JustificationType result = useCase.create(type(null, "Medical leave"));

            // Assert
            assertEquals(7, result.getJustificationTypeId());
            assertEquals("Medical leave", result.getName());
            assertNotNull(result.getCreatedAt());
            assertEquals(Boolean.TRUE, result.getStatus());
            assertEquals(Boolean.FALSE, result.getRequiresAttachment());
            assertEquals(1L, result.getRowVersion());
            verify(repository).findByNameAndSchoolIdIsNull("Medical leave");
            verify(repository).save(any(JustificationType.class));
            verify(eventPublisher).publish(eq("justification-type-events"), anyString());
        }

        @Test
        @DisplayName("Given school scoped type when create then checks name for that school only")
        void givenSchoolScopedType_whenCreate_thenReturnSavedAndPublishEvent() {
            // Arrange
            when(repository.findByNameAndSchoolId("Incapacidad", 7)).thenReturn(Optional.empty());
            when(repository.save(any(JustificationType.class))).thenAnswer(call -> {
                JustificationType saved = call.getArgument(0);
                saved.setJustificationTypeId(8);
                return saved;
            });

            // Act
            JustificationType result = useCase.create(type(7, "Incapacidad"));

            // Assert
            assertEquals(8, result.getJustificationTypeId());
            assertEquals(7, result.getSchoolId());
            verify(repository).findByNameAndSchoolId("Incapacidad", 7);
            verify(repository, never()).findByNameAndSchoolIdIsNull(anyString());
            verify(eventPublisher).publish(eq("justification-type-events"), anyString());
        }
    }

    @Nested
    @DisplayName("TC-05-CJ02: Duplicate rejection")
    class DuplicateTests {

        @Test
        @DisplayName("Given duplicated global name when create then DuplicateEntityException without save nor publish")
        void givenDuplicatedGlobalName_whenCreate_thenThrowAndNeverPersist() {
            // Arrange
            when(repository.findByNameAndSchoolIdIsNull("Medical leave"))
                    .thenReturn(Optional.of(type(null, "Medical leave")));

            // Act & Assert
            DuplicateEntityException ex = assertThrows(DuplicateEntityException.class,
                    () -> useCase.create(type(null, "Medical leave")));
            assertEquals("Global JustificationType already exists with name=Medical leave", ex.getMessage());
            verify(repository, never()).save(any());
            verifyNoInteractions(eventPublisher);
        }

        @Test
        @DisplayName("Given duplicated name for school when create then DuplicateEntityException without save nor publish")
        void givenDuplicatedSchoolName_whenCreate_thenThrowAndNeverPersist() {
            // Arrange
            when(repository.findByNameAndSchoolId("Incapacidad", 7))
                    .thenReturn(Optional.of(type(7, "Incapacidad")));

            // Act & Assert
            DuplicateEntityException ex = assertThrows(DuplicateEntityException.class,
                    () -> useCase.create(type(7, "Incapacidad")));
            assertEquals("JustificationType already exists with name=Incapacidad for schoolId=7", ex.getMessage());
            verify(repository, never()).save(any());
            verifyNoInteractions(eventPublisher);
        }
    }

    @Nested
    @DisplayName("TC-05-CJ03: Validation before persistence")
    class ValidationTests {

        @Test
        @DisplayName("Given blank name when create then IllegalArgumentException before touching repository")
        void givenBlankName_whenCreate_thenThrowBeforeTouchingRepository() {
            // Arrange
            JustificationType blank = type(null, "   ");

            // Act & Assert
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> useCase.create(blank));
            assertEquals("name is required", ex.getMessage());
            verifyNoInteractions(repository);
            verifyNoInteractions(eventPublisher);
        }
    }
}
