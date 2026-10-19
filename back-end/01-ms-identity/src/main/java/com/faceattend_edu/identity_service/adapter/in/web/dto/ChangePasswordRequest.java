package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChangePasswordRequest {

    @NotBlank(message = "currentPassword is required")
    private String currentPassword;

    @NotBlank(message = "newPassword is required")
    private String newPassword;
}
