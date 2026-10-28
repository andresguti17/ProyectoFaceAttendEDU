package com.faceattend_edu.identity_service.adapter.out.persistence.crypto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("SessionTokenHasher")
class SessionTokenHasherTest {

    @Test
    @DisplayName("givenSameToken_whenHash_thenSameDigestDifferentFromToken")
    void deterministicAndDifferentFromToken() {
        UUID token = UUID.randomUUID();

        assertThat(SessionTokenHasher.hash(token)).isEqualTo(SessionTokenHasher.hash(token));
        assertThat(SessionTokenHasher.hash(token)).isNotEqualTo(token);
    }

    @Test
    @DisplayName("givenDifferentTokens_whenHash_thenDifferentDigests")
    void differentTokensDifferentDigests() {
        assertThat(SessionTokenHasher.hash(UUID.randomUUID())).isNotEqualTo(SessionTokenHasher.hash(UUID.randomUUID()));
    }

    @Test
    @DisplayName("givenKnownToken_whenHash_thenStableValue")
    void stableValue() {
        // Fija el algoritmo: cambiarlo invalida todas las sesiones abiertas.
        assertThat(SessionTokenHasher.hash(new UUID(0L, 0L)).toString()).isEqualTo("c4dd742c-3491-8ac9-7c7e-68049dbf972b");
    }

    @Test
    @DisplayName("givenNull_whenHash_thenNull")
    void nullToken() {
        assertThat(SessionTokenHasher.hash(null)).isNull();
    }
}
