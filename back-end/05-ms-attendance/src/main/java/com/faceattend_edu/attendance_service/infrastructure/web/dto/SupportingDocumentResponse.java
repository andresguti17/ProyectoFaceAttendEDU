package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import lombok.Data;
import java.time.Instant;

@Data
public class SupportingDocumentResponse {
    private Long supportingDocumentId;
    private Long justificationId;
    private String fileName;
    private String storageUri;
    private String mimeType;
    private Long sizeBytes;
    private Instant createdAt;
    private long rowVersion;
}
