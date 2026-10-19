package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.port.in.GetAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.CreateJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.DeleteJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListJustificationsUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ReviewJustificationUseCase;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.JustificationWebMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = JustificationController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(JustificationWebMapper.class)
@DisplayName("IEEE 829 TC-05: Justification HTTP Tests")
class JustificationControllerTest {

    private static final String BASE = "/api/v1/justifications";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreateJustificationUseCase createUseCase;
    @MockitoBean
    private ReviewJustificationUseCase reviewUseCase;
    @MockitoBean
    private GetJustificationUseCase getUseCase;
    @MockitoBean
    private ListJustificationsUseCase listUseCase;
    @MockitoBean
    private DeleteJustificationUseCase deleteUseCase;
    @MockitoBean
    private GetAttendanceRecordUseCase recordUseCase;

    private Justification justification(Long id, Long recordId, Integer typeId, String reason, String reviewStatus) {
        Justification j = new Justification();
        j.setJustificationId(id);
        j.setAttendanceRecordId(recordId);
        j.setJustificationTypeId(typeId);
        j.setReason(reason);
        j.setReviewStatus(reviewStatus);
        j.setSubmittedAt(Instant.now());
        j.setCreatedAt(Instant.now());
        j.setRowVersion(1L);
        return j;
    }

    @Nested
    @DisplayName("TC-05-J01: Create justification")
    class CreateTests {

        @Test
        @DisplayName("Given valid request when POST then 201 with justification body")
        void givenValidRequest_whenPost_thenReturn201() throws Exception {
            // Arrange
            when(createUseCase.create(any(Justification.class))).thenAnswer(call -> {
                Justification created = call.getArgument(0);
                created.setJustificationId(10L);
                created.setSubmittedAt(Instant.now());
                created.setCreatedAt(Instant.now());
                created.setReviewStatus("Pending");
                created.setRowVersion(1L);
                return created;
            });

            // Act
            // Assert
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"attendanceRecordId\":1,\"justificationTypeId\":2,\"reason\":\"Medical leave\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.justificationId").value(10))
                    .andExpect(jsonPath("$.attendanceRecordId").value(1))
                    .andExpect(jsonPath("$.justificationTypeId").value(2))
                    .andExpect(jsonPath("$.reason").value("Medical leave"))
                    .andExpect(jsonPath("$.reviewStatus").value("Pending"));
            verify(createUseCase).create(any(Justification.class));
        }

        @Test
        @DisplayName("Given blank reason when POST then 400 and use case never called")
        void givenBlankReason_whenPost_thenReturn400() throws Exception {
            // Arrange

            // Act
            // Assert
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"attendanceRecordId\":1,\"justificationTypeId\":2,\"reason\":\" \"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-002"))
                    .andExpect(jsonPath("$.error.message", containsString("reason")));
            verify(createUseCase, never()).create(any());
        }

        @Test
        @DisplayName("Given duplicate justification when POST then 409 ISO-8.5-DUP-001")
        void givenDuplicateJustification_whenPost_thenReturn409() throws Exception {
            // Arrange
            when(createUseCase.create(any(Justification.class)))
                    .thenThrow(new DuplicateEntityException("Justification already exists for attendanceRecordId=1"));

            // Act
            // Assert
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"attendanceRecordId\":1,\"justificationTypeId\":2,\"reason\":\"Medical leave\"}"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-DUP-001"));
        }
    }

    @Nested
    @DisplayName("TC-05-J02: Get justification by id")
    class GetTests {

        @Test
        @DisplayName("Given existing justification when GET then 200 with body")
        void givenExistingJustification_whenGet_thenReturn200() throws Exception {
            // Arrange
            when(getUseCase.getById(1L)).thenReturn(justification(1L, 100L, 2, "Medical leave", "Pending"));

            // Act
            // Assert
            mockMvc.perform(get(BASE + "/1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.justificationId").value(1))
                    .andExpect(jsonPath("$.attendanceRecordId").value(100))
                    .andExpect(jsonPath("$.reviewStatus").value("Pending"));
        }

        @Test
        @DisplayName("Given unknown justification when GET then 404 ISO-8.5-INT-001")
        void givenUnknownJustification_whenGet_thenReturn404() throws Exception {
            // Arrange
            when(getUseCase.getById(999L)).thenThrow(new EntityNotFoundException("Justification", 999L));

            // Act
            // Assert
            mockMvc.perform(get(BASE + "/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"))
                    .andExpect(jsonPath("$.error.message", containsString("Justification not found")));
        }
    }

    @Nested
    @DisplayName("TC-05-J03: List justifications with in-memory filters")
    class ListTests {

        @Test
        @DisplayName("Given no filters when GET then 200 with all justifications")
        void givenNoFilters_whenGet_thenReturnAll() throws Exception {
            // Arrange
            when(listUseCase.list()).thenReturn(List.of(
                    justification(1L, 100L, 2, "Medical leave", "Pending"),
                    justification(2L, 200L, 3, "Domestic calamity", "Approved")));

            // Act
            // Assert
            mockMvc.perform(get(BASE))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2));
        }

        @Test
        @DisplayName("Given status filter when GET then only matching review status returned")
        void givenStatusFilter_whenGet_thenReturnFiltered() throws Exception {
            // Arrange
            when(listUseCase.list()).thenReturn(List.of(
                    justification(1L, 100L, 2, "Medical leave", "Pending"),
                    justification(2L, 200L, 3, "Domestic calamity", "Approved")));

            // Act
            // Assert
            mockMvc.perform(get(BASE).param("status", "Approved"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].justificationId").value(2))
                    .andExpect(jsonPath("$[0].reviewStatus").value("Approved"));
        }

        @Test
        @DisplayName("Given attendanceRecordId filter when GET then only matching record returned")
        void givenAttendanceRecordIdFilter_whenGet_thenReturnFiltered() throws Exception {
            // Arrange
            when(listUseCase.list()).thenReturn(List.of(
                    justification(1L, 100L, 2, "Medical leave", "Pending"),
                    justification(2L, 200L, 3, "Domestic calamity", "Approved")));

            // Act
            // Assert
            mockMvc.perform(get(BASE).param("attendanceRecordId", "100"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].justificationId").value(1))
                    .andExpect(jsonPath("$[0].attendanceRecordId").value(100));
        }
    }

    @Nested
    @DisplayName("TC-05-J04: Review justification")
    class ReviewTests {

        @Test
        @DisplayName("Given pending justification when PATCH review approved then 200")
        void givenPendingJustification_whenPatchReview_thenReturn200() throws Exception {
            // Arrange
            UUID reviewer = UUID.fromString("11111111-2222-3333-4444-555555555555");
            Justification reviewed = justification(1L, 100L, 2, "Medical leave", "Approved");
            reviewed.setReviewedBy(reviewer);
            reviewed.setReviewedAt(Instant.now());
            reviewed.setResolutionNotes("Accepted with certificate");
            when(reviewUseCase.review(eq(1L), eq("Approved"), eq(reviewer), eq("Accepted with certificate")))
                    .thenReturn(reviewed);

            // Act
            // Assert
            mockMvc.perform(patch(BASE + "/1/review")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"reviewStatus\":\"Approved\",\"reviewedBy\":\"" + reviewer
                                    + "\",\"resolutionNotes\":\"Accepted with certificate\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.justificationId").value(1))
                    .andExpect(jsonPath("$.reviewStatus").value("Approved"))
                    .andExpect(jsonPath("$.reviewedBy").value(reviewer.toString()));
        }

        @Test
        @DisplayName("Given invalid review status when PATCH review then 400 ISO-8.2-VAL-001")
        void givenInvalidReviewStatus_whenPatchReview_thenReturn400() throws Exception {
            // Arrange
            when(reviewUseCase.review(eq(1L), eq("Whatever"), any(), any()))
                    .thenThrow(new ValidationException("reviewStatus must be one of [Approved, Rejected, Pending]"));

            // Act
            // Assert
            mockMvc.perform(patch(BASE + "/1/review")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"reviewStatus\":\"Whatever\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-001"))
                    .andExpect(jsonPath("$.error.message", containsString("reviewStatus")));
        }

        @Test
        @DisplayName("Given already resolved justification when PATCH review then 400 ISO-8.2-VAL-001")
        void givenAlreadyResolvedJustification_whenPatchReview_thenReturn400() throws Exception {
            // Arrange
            when(reviewUseCase.review(eq(1L), eq("Rejected"), any(), any()))
                    .thenThrow(new ValidationException(
                            "Justification already Approved; a resolved justification cannot be reviewed again"));

            // Act
            // Assert
            mockMvc.perform(patch(BASE + "/1/review")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"reviewStatus\":\"Rejected\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-001"))
                    .andExpect(jsonPath("$.error.message", containsString("already Approved")));
        }
    }

    @Nested
    @DisplayName("TC-05-J05: Delete justification")
    class DeleteTests {

        @Test
        @DisplayName("Given existing justification when DELETE then 204")
        void givenExistingJustification_whenDelete_thenReturn204() throws Exception {
            // Arrange

            // Act
            // Assert
            mockMvc.perform(delete(BASE + "/1"))
                    .andExpect(status().isNoContent())
                    .andExpect(header().doesNotExist("Location"));
            verify(deleteUseCase).delete(1L);
        }
    }
}
