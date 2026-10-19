package com.faceattend_edu.scheduling_service.infrastructure.web.dto;

import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
public class EnvironmentResponse {
    private Integer environmentId;
    private Integer schoolId;
    private String code;
    private String name;
    private Short capacity;
    private Boolean status;
    private Instant createdAt;
    private Instant updatedAt;
    private long rowVersion;
    private UUID createdBy;
}
