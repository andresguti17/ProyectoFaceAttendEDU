package com.faceattend_edu.shared.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class DocsAccessTest {

    private static MockHttpServletRequest get(String uri) {
        return new MockHttpServletRequest("GET", uri);
    }

    @Test
    void enabledOpensOnlyTheDocumentationRoutes() {
        var matcher = DocsAccess.matcher(true);
        for (String path : new String[] {"/v3/api-docs", "/v3/api-docs/swagger-config", "/swagger-ui/index.html", "/swagger-ui.html"}) {
            assertThat(matcher.matches(get(path))).as(path).isTrue();
        }
        for (String path : new String[] {"/api/v1/persons", "/actuator/env", "/actuator/health", "/v3/other", "/"}) {
            assertThat(matcher.matches(get(path))).as(path).isFalse();
        }
    }

    @Test
    void disabledOpensNothing() {
        var matcher = DocsAccess.matcher(false);
        for (String path : new String[] {"/v3/api-docs", "/swagger-ui/index.html", "/swagger-ui.html", "/api/v1/persons"}) {
            assertThat(matcher.matches(get(path))).as(path).isFalse();
        }
    }
}
