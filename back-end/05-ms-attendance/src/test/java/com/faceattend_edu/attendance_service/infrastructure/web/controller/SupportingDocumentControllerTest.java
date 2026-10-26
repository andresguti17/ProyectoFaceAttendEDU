package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.GetAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.DeleteSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetSupportingDocumentContentUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListSupportingDocumentsUseCase;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.SupportingDocumentWebMapper;
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

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SupportingDocumentController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SupportingDocumentWebMapper.class)
@DisplayName("IEEE 829 TC-05: Supporting Document HTTP Tests")
class SupportingDocumentControllerTest {

    private static final String BASE = "/api/v1/supporting-documents";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GetSupportingDocumentUseCase getUseCase;
    @MockitoBean
    private ListSupportingDocumentsUseCase listUseCase;
    @MockitoBean
    private DeleteSupportingDocumentUseCase deleteUseCase;
    @MockitoBean
    private GetJustificationUseCase justificationUseCase;
    @MockitoBean
    private GetAttendanceRecordUseCase recordUseCase;
    @MockitoBean
    private GetSupportingDocumentContentUseCase contentUseCase;

    private SupportingDocument document(Long id, Long justificationId, String fileName) {
        SupportingDocument d = new SupportingDocument();
        d.setSupportingDocumentId(id);
        d.setJustificationId(justificationId);
        d.setFileName(fileName);
        d.setStorageUri("s3://faceattend/justifications/" + fileName);
        d.setMimeType("application/pdf");
        d.setSizeBytes(2048L);
        d.setCreatedAt(Instant.now());
        d.setRowVersion(1L);
        return d;
    }

    @Nested
    @DisplayName("TC-05-D01: Create supporting document")
    class CreateTests {

        @Test
        @DisplayName("Given a JSON body with a storage URI when POST then 405: documents only arrive as uploads")
        void givenJsonDocument_whenPost_thenMethodNotAllowed() throws Exception {
            // A client-chosen storageUri could point at someone else's stored file: the only way
            // to add a document is the multipart upload, where the service picks the key.
            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"justificationId\":5,\"fileName\":\"x.pdf\","
                                    + "\"storageUri\":\"justification-documents/2026/10/other.pdf\","
                                    + "\"mimeType\":\"application/pdf\",\"sizeBytes\":2048}"))
                    .andExpect(status().isMethodNotAllowed());
        }
    }

    @Nested
    @DisplayName("TC-05-D02: Get supporting document")
    class GetTests {

        @Test
        @DisplayName("Given existing document when GET then 200 with body")
        void givenExistingDocument_whenGet_thenReturn200() throws Exception {
            // Arrange
            when(getUseCase.getById(9L)).thenReturn(document(9L, 5L, "certificado.pdf"));

            // Act
            // Assert
            mockMvc.perform(get(BASE + "/9"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.supportingDocumentId").value(9))
                    .andExpect(jsonPath("$.justificationId").value(5))
                    .andExpect(jsonPath("$.fileName").value("certificado.pdf"));
        }

        @Test
        @DisplayName("Given unknown document when GET then 404 ISO-8.5-INT-001")
        void givenUnknownDocument_whenGet_thenReturn404() throws Exception {
            // Arrange
            when(getUseCase.getById(999L)).thenThrow(new EntityNotFoundException("SupportingDocument", 999L));

            // Act
            // Assert
            mockMvc.perform(get(BASE + "/999"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.5-INT-001"));
        }
    }

    @Nested
    @DisplayName("TC-05-D03: List supporting documents")
    class ListTests {

        @Test
        @DisplayName("Given justificationId filter when GET then documents of that justification")
        void givenJustificationIdFilter_whenGet_thenReturnFiltered() throws Exception {
            // Arrange
            when(listUseCase.listByJustificationId(5L))
                    .thenReturn(List.of(document(9L, 5L, "certificado.pdf")));

            // Act
            // Assert
            mockMvc.perform(get(BASE).param("justificationId", "5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].justificationId").value(5));
            verify(listUseCase).listByJustificationId(5L);
        }

        @Test
        @DisplayName("Given no justificationId when GET then 400: the whole table is never listed")
        void givenNoFilter_whenGet_thenBadRequest() throws Exception {
            mockMvc.perform(get(BASE)).andExpect(status().isBadRequest());
            verify(listUseCase, never()).listByJustificationId(any());
        }
    }

    @Nested
    @DisplayName("TC-05-D04: Delete supporting document")
    class DeleteTests {

        @Test
        @DisplayName("Given existing document when DELETE then 204")
        void givenExistingDocument_whenDelete_thenReturn204() throws Exception {
            // Arrange

            // Act
            // Assert
            mockMvc.perform(delete(BASE + "/9"))
                    .andExpect(status().isNoContent());
            verify(deleteUseCase).delete(9L);
        }
    }

    @Nested
    @DisplayName("TC-05-D05: Open the stored supporting document")
    class ContentTests {

        @Test
        @DisplayName("Given a stored document when GET content then the bytes come back inline with safe headers")
        void givenStoredDocument_whenGetContent_thenReturnsBytes() throws Exception {
            SupportingDocument doc = document(7L, 3L, "incapacidad médica.pdf");
            byte[] pdf = "%PDF-1.7 test".getBytes();
            when(getUseCase.getById(7L)).thenReturn(doc);
            when(contentUseCase.getContent(7L)).thenReturn(new GetSupportingDocumentContentUseCase.DocumentContent(doc, pdf));

            mockMvc.perform(get(BASE + "/7/content"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", "application/pdf"))
                    .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                    .andExpect(header().string("Content-Disposition", containsString("inline")))
                    .andExpect(content().bytes(pdf));
        }

        @Test
        @DisplayName("Given a legacy row without stored object when GET content then 404")
        void givenLegacyRow_whenGetContent_thenReturns404() throws Exception {
            when(getUseCase.getById(8L)).thenReturn(document(8L, 3L, "old.pdf"));
            when(contentUseCase.getContent(8L)).thenThrow(new EntityNotFoundException("SupportingDocument content", 8L));

            mockMvc.perform(get(BASE + "/8/content")).andExpect(status().isNotFound());
        }
    }
}
