package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Turning the second factor on or off asks for the account password again. */
@Data
public class TwoFactorPasswordRequest {

    @NotBlank(message = "password is required")
    private String password;
}
