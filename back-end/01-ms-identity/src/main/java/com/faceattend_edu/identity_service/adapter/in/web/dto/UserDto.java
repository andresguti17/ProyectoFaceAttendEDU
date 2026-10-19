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
    private LocalDateTime lastAccess;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
