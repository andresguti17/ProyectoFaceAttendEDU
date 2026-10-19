package com.faceattend_edu.identity_service.adapter.in.web.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuthRequestTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void acceptsIdentifierField() throws Exception {
        AuthRequest request = mapper.readValue(
                "{\"identifier\":\"carolina.mendoza@example.com\",\"password\":\"secret\"}",
                AuthRequest.class);

        assertThat(request.getIdentifier()).isEqualTo("carolina.mendoza@example.com");
        assertThat(request.getPassword()).isEqualTo("secret");
    }

    @Test
    void acceptsUsernameAlias() throws Exception {
        AuthRequest request = mapper.readValue(
                "{\"username\":\"admin.faceattend\",\"password\":\"secret\"}",
                AuthRequest.class);

        assertThat(request.getIdentifier()).isEqualTo("admin.faceattend");
    }

    @Test
    void acceptsEmailAlias() throws Exception {
        AuthRequest request = mapper.readValue(
                "{\"email\":\"admin@faceattend.local\",\"password\":\"secret\"}",
                AuthRequest.class);

        assertThat(request.getIdentifier()).isEqualTo("admin@faceattend.local");
    }
}
