package com.faceattend_edu.identity_service.adapter.in.web.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Second step of a login with two-factor: who is signing in and the code e-mailed to them. */
@Data
public class VerifyLoginCodeRequest {

    @JsonAlias({"username", "email"})
    @NotBlank(message = "identifier is required")
    private String identifier;

    @NotBlank(message = "code is required")
    private String code;
}
