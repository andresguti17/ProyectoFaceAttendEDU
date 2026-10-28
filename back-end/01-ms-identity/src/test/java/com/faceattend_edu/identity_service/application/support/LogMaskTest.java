package com.faceattend_edu.identity_service.application.support;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LogMaskTest {

    @Test
    void anAddressKeepsItsFirstLetterAndItsDomain() {
        assertThat(LogMask.email("ana.perez@example.com")).isEqualTo("a***@example.com");
    }

    @Test
    void anythingThatIsNotAnAddressIsFullyHidden() {
        assertThat(LogMask.email(null)).isEqualTo("***");
        assertThat(LogMask.email("")).isEqualTo("***");
        assertThat(LogMask.email("no-at-sign")).isEqualTo("***");
        assertThat(LogMask.email("@example.com")).isEqualTo("***");
    }
}
