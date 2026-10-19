package com.faceattend_edu.scheduling_service.infrastructure.web.dto;

import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;

@Data
public class ClassSessionResponse {
    private Long classSessionId;
    private Long scheduleBlockId;
    private LocalDate sessionDate;
    private String sessionStatus;
    private Long openedBy;
    private Instant openedAt;
    private Long closedBy;
    private Instant closedAt;
    private Instant createdAt;
    private Instant updatedAt;
    private long rowVersion;
}
