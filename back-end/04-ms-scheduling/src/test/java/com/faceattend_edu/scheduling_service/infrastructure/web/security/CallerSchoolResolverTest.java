package com.faceattend_edu.scheduling_service.infrastructure.web.security;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CallerSchoolResolverTest {

    private static final Map<String, Object> BACKEND = Map.of(
            "/api/v1/users/admin-1", Map.of("personId", "p-admin"),
            "/api/v1/academic-actors?personId=p-admin", List.of(
                    Map.of("academicActorId", 5, "personId", "p-admin", "schoolId", 100)),
            "/api/v1/users/teacher-1", Map.of("personId", "p-teacher"),
            "/api/v1/academic-actors?personId=p-teacher", List.of());

    private CallerSchoolResolver resolver() {
        return new CallerSchoolResolver() {
            @Override
            protected Map<?, ?> getMap(String url, String token) {
                return (Map<?, ?>) BACKEND.get(url.substring(url.indexOf("/api/")));
            }

            @Override
            @SuppressWarnings("unchecked")
            protected List<Map<?, ?>> getList(String url, String token) {
                Object value = BACKEND.get(url.substring(url.indexOf("/api/")));
                return value == null ? List.of() : (List<Map<?, ?>>) value;
            }
        };
    }

    @Test
    void superAdminIsUnrestrictedWithoutResolvingAnyActor() {
        CallerSchoolResolver.CallerSchool result =
                resolver().resolve("whoever", List.of("Super Administrador"), "t");

        assertThat(result.isSuperAdmin()).isTrue();
        assertThat(result.schoolId()).isNull();
        assertThat(result.ownActorId()).isNull();
    }

    @Test
    void schoolAdminResolvesOwnSchoolAndOwnActorId() {
        CallerSchoolResolver.CallerSchool result =
                resolver().resolve("admin-1", List.of("Administrador"), "t");

        assertThat(result.isSuperAdmin()).isFalse();
        assertThat(result.schoolId()).isEqualTo(100);
        assertThat(result.ownActorId()).isEqualTo(5L);
    }

    @Test
    void callerWithoutAnAcademicActorFailsSecureToNoSchool() {
        CallerSchoolResolver.CallerSchool result =
                resolver().resolve("teacher-1", List.of("Instructor"), "t");

        assertThat(result.isSuperAdmin()).isFalse();
        assertThat(result.schoolId()).isNull();
        assertThat(result.ownActorId()).isNull();
    }
}
