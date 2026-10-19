package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

/**
 * Request body for POST /api/v1/users. Kept separate from UserDto so the
 * credential never travels on a response payload.
 */
@Data
public class CreateUserRequest {

    @NotNull(message = "personId is required")
    private UUID personId;

    @NotBlank(message = "username is required")
    @Size(max = 255, message = "username must be at most 255 characters")
    private String username;

    @NotBlank(message = "password is required")
    @Size(min = 8, max = 100, message = "password must be between 8 and 100 characters")
    private String password;

    private String authenticationType;
}
