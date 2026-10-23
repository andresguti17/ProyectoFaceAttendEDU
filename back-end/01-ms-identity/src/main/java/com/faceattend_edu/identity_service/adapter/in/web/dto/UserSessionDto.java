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
    /** The password was right but a code was e-mailed: finish with POST /auth/login/verify (no session yet). */
    private boolean twoFactorRequired;
    /** Where the code went, with the middle masked; set only with twoFactorRequired. */
    private String maskedEmail;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private String sourceIp;
}
