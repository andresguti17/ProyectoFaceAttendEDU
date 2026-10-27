package com.faceattend_edu.authorization_service.config;

import com.faceattend_edu.authorization_service.infrastructure.web.security.AuthTokenFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Con springdoc activado (desarrollo) la documentación se abre; todo lo demás sigue cerrado. */
@WebMvcTest(controllers = AppConfigSecurityTest.NoControllers.class)
@Import({AppConfig.class, AuthTokenFilter.class})
@TestPropertySource(properties = "springdoc.api-docs.enabled=true")
class AppConfigSecurityDocsEnabledTest {

    @Autowired
    MockMvc mvc;

    private int statusOf(String path) throws Exception {
        return mvc.perform(get(path)).andReturn().getResponse().getStatus();
    }

    @Test
    void docsRoutesAreOpenForDevelopment() throws Exception {
        assertThat(statusOf("/v3/api-docs")).isNotEqualTo(403);
        assertThat(statusOf("/swagger-ui/index.html")).isNotEqualTo(403);
    }

    @Test
    void everythingElseStillNeedsAuthentication() throws Exception {
        assertThat(statusOf("/actuator/env")).isEqualTo(403);
        assertThat(statusOf("/other")).isEqualTo(403);
    }
}
