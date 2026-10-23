package com.faceattend_edu.identity_service.adapter.in.web.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class UserDto {
    private UUID userId;
    private UUID personId;
    private String username;
    private String authenticationType;
    private Boolean status;
    private Boolean mustChangePassword;
    private Boolean twoFactorEnabled;
    /** SENT | SKIPPED | FAILED when the create call asked to email the credentials; null otherwise. */
    private String credentialsEmail;
    private LocalDateTime lastAccess;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
