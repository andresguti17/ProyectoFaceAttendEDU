package com.faceattend_edu.authorization_service.config;

import com.faceattend_edu.authorization_service.infrastructure.web.security.AuthTokenFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * La cadena de seguridad real de authorization, con springdoc apagado (producción): qué rutas abre
 * sin sesión. Las rutas que no empiezan por /api/ no las toca AuthTokenFilter, así que decide solo
 * {@link AppConfig}: abierta = el recurso simplemente no existe; cerrada = 403.
 */
@WebMvcTest(controllers = AppConfigSecurityTest.NoControllers.class)
@Import({AppConfig.class, AuthTokenFilter.class})
@TestPropertySource(properties = "springdoc.api-docs.enabled=false")
class AppConfigSecurityTest {

    /** Marca vacía: evita que @WebMvcTest cargue todos los controladores del servicio. */
    @RestController
    static class NoControllers {}

    @Autowired
    MockMvc mvc;

    private int statusOf(String path) throws Exception {
        return mvc.perform(get(path)).andReturn().getResponse().getStatus();
    }

    @Test
    void docsRoutesStayBehindAuthenticationLikeAnyUnknownPath() throws Exception {
        assertThat(statusOf("/v3/api-docs")).isEqualTo(403);
        assertThat(statusOf("/swagger-ui/index.html")).isEqualTo(403);
        assertThat(statusOf("/swagger-ui.html")).isEqualTo(403);
    }

    @Test
    void onlyHealthIsOpenOfTheActuator() throws Exception {
        assertThat(statusOf("/health")).isNotEqualTo(403);
        assertThat(statusOf("/actuator/health")).isNotEqualTo(403);
        assertThat(statusOf("/actuator/info")).isEqualTo(403);
        assertThat(statusOf("/actuator/env")).isEqualTo(403);
    }
}
