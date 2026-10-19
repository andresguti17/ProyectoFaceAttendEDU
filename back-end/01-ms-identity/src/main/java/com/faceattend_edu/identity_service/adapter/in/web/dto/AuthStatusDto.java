package com.faceattend_edu.identity_service.adapter.in.web.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Respuesta uniforme de las operaciones de autenticación que no devuelven
 * entidad (recuperación de contraseña). El status nunca depende de si la
 * cuenta existe, para no filtrar usuarios.
 */
@Data
@AllArgsConstructor
public class AuthStatusDto {

    /**
     * accepted | verified | updated. The value never depends on whether the
     * account exists, so the response cannot be used to enumerate users.
     */
    private String status;

    private String message;

    public static AuthStatusDto accepted() {
        return new AuthStatusDto("accepted", "Request accepted");
    }

    public static AuthStatusDto verified() {
        return new AuthStatusDto("verified", "Code verified");
    }

    public static AuthStatusDto updated() {
        return new AuthStatusDto("updated", "Password updated");
    }
}
