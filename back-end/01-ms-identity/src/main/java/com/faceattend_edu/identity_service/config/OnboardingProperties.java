package com.faceattend_edu.identity_service.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Ajustes del alta pública de sedes (POST /api/v1/onboarding/schools).
 *
 * <p>El alta encadena llamadas a academic y authorization, que exigen sesión +
 * RBAC. Identity abre una sesión interna a nombre de una cuenta de servicio
 * (un Super Administrador dedicado) solo mientras dura la solicitud.
 * {@code service-user-id} vacío deshabilita el endpoint (503).</p>
 */
@Getter
@Setter
@Component
public class OnboardingProperties {

    /** user_id de la cuenta de servicio con permisos de Super Administrador. */
    @Value("${faceattend.onboarding.service-user-id:}")
    private String serviceUserId = "";

    @Value("${faceattend.onboarding.academic-url:http://localhost:8083}")
    private String academicUrl = "http://localhost:8083";

    @Value("${faceattend.onboarding.authorization-url:http://localhost:8082}")
    private String authorizationUrl = "http://localhost:8082";

    public boolean enabled() {
        return serviceUserId != null && !serviceUserId.isBlank();
    }
}
