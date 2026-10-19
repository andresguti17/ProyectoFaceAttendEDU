package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyCodeRequest {

    @NotBlank(message = "email is required")
    private String email;

    @NotBlank(message = "code is required")
    private String code;
}
