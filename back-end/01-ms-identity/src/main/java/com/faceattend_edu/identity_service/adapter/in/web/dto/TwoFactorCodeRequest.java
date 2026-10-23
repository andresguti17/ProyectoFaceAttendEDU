package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** The code e-mailed when enabling the second factor. */
@Data
public class TwoFactorCodeRequest {

    @NotBlank(message = "code is required")
    private String code;
}
