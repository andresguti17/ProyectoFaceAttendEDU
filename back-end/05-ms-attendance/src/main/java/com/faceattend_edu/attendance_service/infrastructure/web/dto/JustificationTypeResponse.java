package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import lombok.Data;
import java.time.Instant;

@Data
public class JustificationTypeResponse {
    private Integer justificationTypeId;
    private Integer schoolId;
    private String name;
    private String description;
    private Boolean requiresAttachment;
    private Boolean status;
    private Instant createdAt;
    private long rowVersion;
}
