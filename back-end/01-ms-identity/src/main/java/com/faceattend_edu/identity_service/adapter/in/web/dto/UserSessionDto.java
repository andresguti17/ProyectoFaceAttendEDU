package com.faceattend_edu.identity_service.adapter.in.web.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class UserSessionDto {
    private UUID sessionId;
    private UUID userId;
    private String sessionStatus;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private String sourceIp;
}
