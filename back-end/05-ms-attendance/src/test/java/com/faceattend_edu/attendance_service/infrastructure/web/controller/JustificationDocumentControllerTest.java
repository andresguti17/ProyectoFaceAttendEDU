package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.GetAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.UploadSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.SupportingDocumentWebMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = JustificationDocumentController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SupportingDocumentWebMapper.class)
@DisplayName("IEEE 829 TC-05: supporting document multipart upload")
class JustificationDocumentControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean UploadSupportingDocumentUseCase uploadUseCase;
    @MockitoBean GetJustificationUseCase justificationUseCase;
    @MockitoBean GetAttendanceRecordUseCase recordUseCase;

    @Test
    @DisplayName("A multipart PDF is uploaded and the stored document comes back with 201")
    void uploadsFile() throws Exception {
        byte[] pdf = "%PDF-1.7 body".getBytes(StandardCharsets.US_ASCII);
        SupportingDocument saved = new SupportingDocument();
        saved.setSupportingDocumentId(12L);
        saved.setJustificationId(5L);
        saved.setFileName("incapacidad.pdf");
        saved.setStorageUri("justification-documents/2026/10/abc.pdf");
        saved.setMimeType("application/pdf");
        saved.setSizeBytes((long) pdf.length);
        saved.setCreatedAt(Instant.now());
        when(uploadUseCase.upload(eq(5L), eq("incapacidad.pdf"), eq(pdf))).thenReturn(saved);

        mockMvc.perform(multipart("/api/v1/justifications/5/documents")
                        .file(new MockMultipartFile("file", "incapacidad.pdf", "application/pdf", pdf)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.supportingDocumentId").value(12))
                .andExpect(jsonPath("$.storageUri").value("justification-documents/2026/10/abc.pdf"));
    }

    @Test
    @DisplayName("A request without the file part answers 400")
    void missingFile() throws Exception {
        mockMvc.perform(multipart("/api/v1/justifications/5/documents"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("A rejected file type answers 400 with the validation error")
    void rejectedType() throws Exception {
        when(uploadUseCase.upload(eq(5L), any(), any())).thenThrow(new ValidationException("file must be a PDF, JPG or PNG document"));

        mockMvc.perform(multipart("/api/v1/justifications/5/documents")
                        .file(new MockMultipartFile("file", "x.exe", "application/octet-stream", "MZ".getBytes(StandardCharsets.US_ASCII))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-001"));
    }
}
