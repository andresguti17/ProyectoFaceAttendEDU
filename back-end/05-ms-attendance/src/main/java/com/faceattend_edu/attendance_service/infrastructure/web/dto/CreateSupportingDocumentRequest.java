package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class CreateSupportingDocumentRequest {
    @NotNull private Long justificationId;
    @NotBlank private String fileName;
    @NotBlank private String storageUri;
    @NotBlank private String mimeType;
    @NotNull @Positive private Long sizeBytes;
}
