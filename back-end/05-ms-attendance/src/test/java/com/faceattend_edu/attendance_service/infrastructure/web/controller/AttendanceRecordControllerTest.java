package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordSlice;
import com.faceattend_edu.attendance_service.domain.port.in.*;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.*;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.AttendanceRecordWebMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

/**
 * IEEE 829 — Test Case Specification
 * Service: 05-ms-attendance
 * Entity: AttendanceRecord
 * Test IDs: TC-05-001 through TC-05-006
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("IEEE 829 TC-05: Attendance Record CRUD Tests")
class AttendanceRecordControllerTest {

    @Mock
    private CreateAttendanceRecordUseCase createUseCase;
    @Mock
    private UpdateAttendanceRecordUseCase updateUseCase;
    @Mock
    private GetAttendanceRecordUseCase getUseCase;
    @Mock
    private ListAttendanceRecordsUseCase listUseCase;
    @Mock
    private DeleteAttendanceRecordUseCase deleteUseCase;
    @Mock
    private BulkRecordAttendanceUseCase bulkUseCase;
    @Mock
    private AttendanceRecordWebMapper mapper;

    @InjectMocks
    private AttendanceRecordController controller;

    private AttendanceRecord sampleRecord;
    private AttendanceRecordResponse sampleResponse;

    @BeforeEach
    void setUp() {
        sampleRecord = new AttendanceRecord();
        sampleRecord.setAttendanceRecordId(1L);
        sampleRecord.setClassSessionId(100L);
        sampleRecord.setAcademicActorId(200L);
        sampleRecord.setAttendanceStatus("Present");
        sampleRecord.setCaptureMethod("FACIAL");
        sampleRecord.setMatchScore(new BigDecimal("0.95"));
        sampleRecord.setCreatedAt(Instant.now());

        sampleResponse = new AttendanceRecordResponse();
        sampleResponse.setAttendanceRecordId(1L);
        sampleResponse.setClassSessionId(100L);
        sampleResponse.setAcademicActorId(200L);
        sampleResponse.setAttendanceStatus("Present");
        sampleResponse.setCaptureMethod("FACIAL");
        sampleResponse.setMatchScore(new BigDecimal("0.95"));
    }

    @Nested
    @DisplayName("TC-05-001: Create Attendance Record")
    class CreateTests {

        @Test
        @DisplayName("Should create attendance record with valid data")
        void shouldCreateRecord() {
            // Arrange
            CreateAttendanceRecordRequest request = new CreateAttendanceRecordRequest();
            request.setClassSessionId(100L);
            request.setAcademicActorId(200L);
            request.setAttendanceStatus("Present");
            request.setCaptureMethod("FACIAL");

            when(mapper.toDomain(any(CreateAttendanceRecordRequest.class))).thenReturn(sampleRecord);
            when(createUseCase.create(any())).thenReturn(sampleRecord);
            when(mapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.create(request);

            // Assert
            assertEquals(201, response.getStatusCode().value());
            assertNotNull(response.getBody());
            assertEquals(1L, response.getBody().getAttendanceRecordId());
            verify(createUseCase, times(1)).create(any());
        }
    }

    @Nested
    @DisplayName("TC-05-002: Get Attendance Record by ID")
    class GetByIdTests {

        @Test
        @DisplayName("Should return attendance record when found")
        void shouldReturnRecord() {
            // Arrange
            when(getUseCase.getById(1L)).thenReturn(sampleRecord);
            when(mapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.get(1L);

            // Assert
            assertEquals(200, response.getStatusCode().value());
            assertNotNull(response.getBody());
            assertEquals(1L, response.getBody().getAttendanceRecordId());
        }

        @Test
        @DisplayName("Should throw exception when record not found")
        void shouldThrowWhenNotFound() {
            // Arrange
            when(getUseCase.getById(999L)).thenThrow(new RuntimeException("Not found"));

            // Act & Assert
            assertThrows(RuntimeException.class, () -> controller.get(999L));
        }
    }

    @Nested
    @DisplayName("TC-05-003: Update Attendance Record")
    class UpdateTests {

        @Test
        @DisplayName("Should update attendance record status")
        void shouldUpdateRecord() {
            // Arrange
            UpdateAttendanceRecordRequest request = new UpdateAttendanceRecordRequest();
            request.setAttendanceStatus("Absent");

            AttendanceRecord updatedRecord = new AttendanceRecord();
            updatedRecord.setAttendanceRecordId(1L);
            updatedRecord.setAttendanceStatus("Absent");

            when(updateUseCase.update(eq(1L), any())).thenReturn(updatedRecord);
            when(mapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.update(1L, request);

            // Assert
            assertEquals(200, response.getStatusCode().value());
            verify(updateUseCase, times(1)).update(eq(1L), any());
        }
    }

    @Nested
    @DisplayName("TC-05-004: Delete Attendance Record")
    class DeleteTests {

        @Test
        @DisplayName("Should delete attendance record")
        void shouldDeleteRecord() {
            // Arrange
            doNothing().when(deleteUseCase).delete(1L);

            // Act
            var response = controller.delete(1L);

            // Assert
            assertEquals(204, response.getStatusCode().value());
            verify(deleteUseCase, times(1)).delete(1L);
        }
    }

    @Nested
    @DisplayName("TC-05-005: List Attendance Records")
    class ListTests {

        @Test
        @DisplayName("Should list all attendance records")
        void shouldListRecords() {
            // Arrange
            when(listUseCase.search(any(), eq(0), eq(100))).thenReturn(new AttendanceRecordSlice(List.of(sampleRecord), 81000));
            when(mapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.list(null, null, null, null, null);

            // Assert: sin filtros ni limit ya no devuelve la tabla entera (OutOfMemoryError con ~81k filas)
            assertEquals(200, response.getStatusCode().value());
            assertFalse(response.getBody().isEmpty());
            assertEquals("81000", response.getHeaders().getFirst("X-Total-Count"));
        }

        @Test
        @DisplayName("Should filter records by status")
        void shouldFilterByStatus() {
            // Arrange
            when(listUseCase.search(any(), eq(0), eq(100))).thenReturn(new AttendanceRecordSlice(List.of(sampleRecord), 1));
            when(mapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.list(null, null, "Present", null, null);

            // Assert: el estado viaja a la consulta SQL
            assertEquals(200, response.getStatusCode().value());
            verify(listUseCase).search(eq(new AttendanceRecordFilter(null, null, "Present", null)), eq(0), eq(100));
        }

        @Test
        @DisplayName("Should paginate records with limit and offset")
        void shouldPaginateRecords() {
            // Arrange
            when(listUseCase.search(any(), eq(1), eq(2))).thenReturn(new AttendanceRecordSlice(List.of(sampleRecord, sampleRecord), 3));
            when(mapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.list(null, null, null, 2, 1);

            // Assert
            assertEquals(200, response.getStatusCode().value());
            assertEquals(2, response.getBody().size());
            assertEquals("3", response.getHeaders().getFirst("X-Total-Count"));
        }

        @Test
        @DisplayName("Should return every record of an actor when no limit is given")
        void shouldListAllRecordsOfAnActorWithoutLimit() {
            // Arrange
            when(listUseCase.search(any(), eq(0), isNull())).thenReturn(new AttendanceRecordSlice(List.of(sampleRecord), 1));
            when(mapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.list(null, 7L, null, null, null);

            // Assert: con filtro y sin limit se conserva el contrato de lista completa sin cabecera
            assertEquals(1, response.getBody().size());
            assertNull(response.getHeaders().getFirst("X-Total-Count"));
            verify(listUseCase).search(eq(new AttendanceRecordFilter(null, 7L, null, null)), eq(0), isNull());
        }
    }

    @Nested
    @DisplayName("TC-05-006: Bulk Create Attendance Records")
    class BulkCreateTests {

        @Test
        @DisplayName("Should create multiple records in bulk")
        void shouldBulkCreate() {
            // Arrange
            CreateAttendanceRecordRequest req1 = new CreateAttendanceRecordRequest();
            req1.setClassSessionId(100L);
            req1.setAcademicActorId(200L);
            req1.setAttendanceStatus("Present");
            req1.setCaptureMethod("FACIAL");

            List<CreateAttendanceRecordRequest> requests = Arrays.asList(req1);

            when(mapper.toDomain(any(CreateAttendanceRecordRequest.class))).thenReturn(sampleRecord);
            when(bulkUseCase.bulk(any())).thenReturn(Arrays.asList(sampleRecord));
            when(mapper.toResponse(any())).thenReturn(sampleResponse);

            // Act
            var response = controller.bulk(requests);

            // Assert
            assertEquals(201, response.getStatusCode().value());
            assertFalse(response.getBody().isEmpty());
        }
    }
}
