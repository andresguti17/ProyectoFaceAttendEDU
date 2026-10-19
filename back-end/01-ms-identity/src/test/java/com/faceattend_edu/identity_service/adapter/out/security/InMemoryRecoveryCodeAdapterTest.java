package com.faceattend_edu.identity_service.adapter.out.security;

import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort.IssuedCode;
import com.faceattend_edu.identity_service.config.AuthProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * IEEE 829 - casos del almacén en memoria de códigos de recuperación:
 * emisión, normalización, cooldown, intentos, expiración y consumo único.
 */
class InMemoryRecoveryCodeAdapterTest {

    private static final String EMAIL = "Carolina.Mendoza@Example.com";

    private InMemoryRecoveryCodeAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new InMemoryRecoveryCodeAdapter(new AuthProperties());
    }

    @Test
    void issuesSixDigitCodeThatVerifies() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));

        assertThat(issued).isNotNull();
        assertThat(issued.code()).matches("\\d{6}");
        assertThat(issued.expiresAt()).isAfter(java.time.LocalDateTime.now());
        assertThat(adapter.verify("carolina.mendoza@example.com", issued.code())).isTrue();
    }

    @Test
    void normalizesEmailCaseSoDifferentSpellingsShareOneChallenge() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));

        assertThat(adapter.verify("CAROLINA.MENDOZA@EXAMPLE.COM", issued.code())).isTrue();
    }

    @Test
    void blocksResendDuringCooldown() {
        assertThat(adapter.issue(EMAIL, Duration.ofMinutes(10))).isNotNull();

        assertThat(adapter.issue(EMAIL, Duration.ofMinutes(10))).isNull();
    }

    @Test
    void rejectsWrongCodeAndInvalidatesAfterMaxAttempts() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));
        String wrong = issued.code().equals("000000") ? "111111" : "000000";

        for (int attempt = 1; attempt <= 5; attempt++) {
            assertThat(adapter.verify(EMAIL, wrong)).isFalse();
        }

        // El reto se destruyó al agotar los intentos: el código bueno ya no sirve.
        assertThat(adapter.verify(EMAIL, issued.code())).isFalse();
    }

    @Test
    void rejectsExpiredCode() throws Exception {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ZERO);
        Thread.sleep(20);

        assertThat(adapter.verify(EMAIL, issued.code())).isFalse();
    }

    @Test
    void consumesVerifiedChallengeOnlyOnce() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));
        adapter.verify(EMAIL, issued.code());

        assertThat(adapter.consumeVerified(EMAIL)).isTrue();
        assertThat(adapter.consumeVerified(EMAIL)).isFalse();
    }

    @Test
    void neverConsumesAnUnverifiedChallenge() {
        adapter.issue(EMAIL, Duration.ofMinutes(10));

        assertThat(adapter.consumeVerified(EMAIL)).isFalse();
        assertThat(adapter.consumeVerified("unknown@faceattend.local")).isFalse();
    }

    @Test
    void purgesExpiredChallengesSoTheStoreDoesNotGrow() throws Exception {
        adapter.issue(EMAIL, Duration.ZERO);
        Thread.sleep(20);

        adapter.issue("otro@faceattend.local", Duration.ofMinutes(10));

        assertThat(adapter.size()).isEqualTo(1);
    }
}
