package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Tercer paso de la recuperación. El cliente no reenvía el código: el reto ya
 * quedó verificado en /verify-code y el backend lo exige por su cuenta.
 */
@Data
public class ResetPasswordRequest {

    @NotBlank(message = "email is required")
    private String email;

    @NotBlank(message = "password is required")
    private String password;
}
