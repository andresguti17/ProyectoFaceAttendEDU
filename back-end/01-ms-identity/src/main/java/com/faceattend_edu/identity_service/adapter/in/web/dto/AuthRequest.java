package com.faceattend_edu.identity_service.adapter.in.web.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Login payload. The identifier is either an email or a username: clients may send it as
 * {"identifier": "..."}, {"email": "..."} or {"username": "..."}.
 */
@Data
public class AuthRequest {

    @JsonAlias({"username", "email"})
    @NotBlank(message = "identifier is required")
    private String identifier;

    @NotBlank(message = "password is required")
    private String password;
}
