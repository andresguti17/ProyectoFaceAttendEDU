package com.faceattend_edu.attendance_service.infrastructure.web.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CallerSchoolResolverRetryTest {

    private static final ResourceAccessException IO = new ResourceAccessException("I/O error on GET", new IOException("reset"));

    @Test
    @SuppressWarnings("unchecked")
    void aTransientIoFailureIsRetriedOnce() {
        RestTemplate rest = mock(RestTemplate.class);
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(IO)
                .thenReturn(ResponseEntity.ok(Map.of("personId", "p1")));
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(List.class)))
                .thenReturn(ResponseEntity.ok(List.of(Map.of("schoolId", 7))));

        CallerSchoolResolver.CallerSchool result =
                new CallerSchoolResolver(rest).resolve("u1", List.of("Administrador"), "t");

        assertThat(result.schoolId()).isEqualTo(7);
        verify(rest, times(2)).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class));
    }

    @Test
    void aPersistentFailureStillFailsSecure() {
        RestTemplate rest = mock(RestTemplate.class);
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class))).thenThrow(IO);

        assertThatThrownBy(() -> new CallerSchoolResolver(rest).resolve("u2", List.of("Administrador"), "t"))
                .isInstanceOf(RuntimeException.class);
        verify(rest, times(2)).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class));
    }

    @Test
    void httpErrorStatusesAreNotRetried() {
        RestTemplate rest = mock(RestTemplate.class);
        when(rest.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new HttpServerErrorException(HttpStatus.BAD_GATEWAY));

        assertThatThrownBy(() -> new CallerSchoolResolver(rest).resolve("u3", List.of("Administrador"), "t"))
                .isInstanceOf(HttpServerErrorException.class);
        verify(rest, times(1)).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class));
    }
}
