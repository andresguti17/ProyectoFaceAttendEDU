package com.faceattend_edu.identity_service.adapter.in.web.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class UserSessionDto {
    private UUID sessionId;
    private UUID userId;
    private String sessionStatus;
    /** The account still uses the initial password: the client must force a change before anything else. */
    private boolean mustChangePassword;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private String sourceIp;
}
