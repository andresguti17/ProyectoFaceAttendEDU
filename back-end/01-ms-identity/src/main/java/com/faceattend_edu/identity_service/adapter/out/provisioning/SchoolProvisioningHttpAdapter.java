package com.faceattend_edu.identity_service.adapter.out.provisioning;

import com.faceattend_edu.identity_service.application.port.in.OnboardSchoolUseCase;
import com.faceattend_edu.identity_service.application.port.out.SchoolProvisioningPort;
import com.faceattend_edu.identity_service.application.port.out.UserProvisioningPort;
import com.faceattend_edu.identity_service.config.OnboardingProperties;
import com.faceattend_edu.identity_service.domain.exception.DownstreamRejectedException;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.OnboardingUnavailableException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Outbound adapter for the school sign-up and the account provisioning: talks to
 * 03-ms-academic (schools, academic actors, enrollments) and 02-ms-authorization
 * (roles) over the internal network. The school sign-up uses the session it opened
 * for the service account; provisioning uses the caller's own session.
 */
@Component
public class SchoolProvisioningHttpAdapter implements SchoolProvisioningPort, UserProvisioningPort {

    /** academic_actor_type 3 = ADMIN (administrador de sede). */
    static final int ADMIN_ACTOR_TYPE_ID = 3;
    /** Role names accepted for a school administrator (Spanish seed + legacy English). */
    static final Set<String> ADMIN_ROLE_NAMES = Set.of("administrador", "school admin");

    private final OnboardingProperties properties;
    private final RestTemplate restTemplate;

    public SchoolProvisioningHttpAdapter(OnboardingProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        // A service that has been idle can take several seconds to answer its first call.
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(20000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    @SuppressWarnings("unchecked")
    public boolean schoolCodeExists(String token, String code) {
        return findSchoolIdByCode(token, code) != null;
    }

    @Override
    @SuppressWarnings("unchecked")
    public Long findSchoolIdByCode(String token, String code) {
        List<Map<String, Object>> schools = exchangeIdempotent(HttpMethod.GET, academic("/api/v1/schools"), token, List.class).getBody();
        if (schools == null) return null;
        return schools.stream()
                .filter(s -> code.equalsIgnoreCase(String.valueOf(s.get("code"))))
                .map(s -> s.get("schoolId"))
                .filter(Number.class::isInstance)
                .map(id -> ((Number) id).longValue())
                .findFirst()
                .orElse(null);
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<Long> findActorIdsByPerson(String token, UUID personId) {
        List<Map<String, Object>> actors = exchangeIdempotent(
                HttpMethod.GET, academic("/api/v1/academic-actors?personId=" + personId), token, List.class).getBody();
        if (actors == null) return List.of();
        return actors.stream()
                .map(a -> a.get("academicActorId"))
                .filter(Number.class::isInstance)
                .map(id -> ((Number) id).longValue())
                .toList();
    }

    @Override
    @SuppressWarnings("unchecked")
    public long createSchool(String token, OnboardSchoolUseCase.School school) {
        Map<String, Object> body = new HashMap<>();
        body.put("code", school.code());
        body.put("name", school.name());
        putIfPresent(body, "cityName", school.cityName());
        putIfPresent(body, "address", school.address());
        putIfPresent(body, "phone", school.phone());
        putIfPresent(body, "email", school.email());
        body.put("status", false);
        try {
            Map<String, Object> created = exchange(HttpMethod.POST, academic("/api/v1/schools"), token, body, Map.class).getBody();
            return asLong(created, "schoolId");
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode().value() == 409) throw new DuplicateEntityException("School", school.code());
            throw unavailable("create school", ex);
        } catch (ResourceAccessException ex) {
            // The call timed out, but the school may have been created anyway: look before giving up
            // (and before the rollback has to guess).
            Long existing = findSchoolIdByCode(token, school.code());
            if (existing != null) return existing;
            throw new OnboardingUnavailableException("Could not create school (no answer)", ex);
        }
    }

    @Override
    public void assignAdminRole(String token, UUID userId) {
        Map<String, Object> body = Map.of("roleId", adminRoleId(token));
        String url = authorization("/api/v1/users/" + userId + "/roles");
        try {
            try {
                exchange(HttpMethod.POST, url, token, body, Map.class);
            } catch (ResourceAccessException timeout) {
                // May have gone through despite the timeout: assigning again is harmless (409 = already assigned).
                exchange(HttpMethod.POST, url, token, body, Map.class);
            }
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode().value() == 409) return;
            throw unavailable("assign role", ex);
        } catch (ResourceAccessException ex) {
            throw new OnboardingUnavailableException("Could not assign role (no answer)", ex);
        }
    }

    @Override
    public void removeAdminRole(String token, UUID userId) {
        deleteIgnoringMissing(authorization("/api/v1/users/" + userId + "/roles/" + adminRoleId(token)), token);
    }

    @Override
    @SuppressWarnings("unchecked")
    public long linkAdminToSchool(String token, UUID personId, long schoolId, String actorCode) {
        Map<String, Object> body = new HashMap<>();
        body.put("personId", personId.toString());
        body.put("actorTypeId", ADMIN_ACTOR_TYPE_ID);
        body.put("schoolId", schoolId);
        body.put("actorCode", actorCode);
        try {
            Map<String, Object> created = exchange(HttpMethod.POST, academic("/api/v1/academic-actors"), token, body, Map.class).getBody();
            return asLong(created, "academicActorId");
        } catch (HttpStatusCodeException ex) {
            throw unavailable("link administrator", ex);
        } catch (ResourceAccessException ex) {
            // Same ambiguity as createSchool: the actor may exist even though the answer never came.
            List<Long> existing = findActorIdsByPerson(token, personId);
            if (!existing.isEmpty()) return existing.get(0);
            throw new OnboardingUnavailableException("Could not link administrator (no answer)", ex);
        }
    }

    @Override
    public void deleteActor(String token, long actorId) {
        deleteIgnoringMissing(academic("/api/v1/academic-actors/" + actorId), token);
    }

    // ── Account provisioning (UserProvisioningPort) ─────────────────────────

    @Override
    @SuppressWarnings("unchecked")
    public long createActor(String token, UUID personId, int actorTypeId, long schoolId, String actorCode) {
        Map<String, Object> body = new HashMap<>();
        body.put("personId", personId.toString());
        body.put("actorTypeId", actorTypeId);
        body.put("schoolId", schoolId);
        body.put("actorCode", actorCode.trim());
        body.put("startedOn", java.time.LocalDate.now().toString());
        body.put("status", true);
        try {
            Map<String, Object> created = exchange(HttpMethod.POST, academic("/api/v1/academic-actors"), token, body, Map.class).getBody();
            return asLong(created, "academicActorId");
        } catch (HttpStatusCodeException ex) {
            throw downstream("create the academic actor", ex);
        } catch (ResourceAccessException ex) {
            List<Long> existing = findActorIdsByPerson(token, personId);
            if (!existing.isEmpty()) return existing.get(0);
            throw new OnboardingUnavailableException("Could not create the academic actor (no answer)", ex);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public long createEnrollment(String token, long actorId, long cohortId) {
        Map<String, Object> body = new HashMap<>();
        body.put("academicActorId", actorId);
        body.put("cohortId", cohortId);
        body.put("enrolledOn", java.time.LocalDate.now().toString());
        body.put("enrollmentStatus", "Active");
        try {
            Map<String, Object> created = exchange(HttpMethod.POST, academic("/api/v1/enrollments"), token, body, Map.class).getBody();
            return asLong(created, "enrollmentId");
        } catch (HttpStatusCodeException ex) {
            throw downstream("enroll the apprentice", ex);
        } catch (ResourceAccessException ex) {
            throw new OnboardingUnavailableException("Could not enroll the apprentice (no answer)", ex);
        }
    }

    @Override
    public void deleteEnrollment(String token, long enrollmentId) {
        deleteIgnoringMissing(academic("/api/v1/enrollments/" + enrollmentId), token);
    }

    @Override
    public void assignRole(String token, UUID userId, String roleName) {
        Map<String, Object> body = Map.of("roleId", roleIdByName(token, roleName));
        String url = authorization("/api/v1/users/" + userId + "/roles");
        try {
            try {
                exchange(HttpMethod.POST, url, token, body, Map.class);
            } catch (ResourceAccessException timeout) {
                exchange(HttpMethod.POST, url, token, body, Map.class);
            }
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode().value() == 409) return;
            throw downstream("assign the role", ex);
        } catch (ResourceAccessException ex) {
            throw new OnboardingUnavailableException("Could not assign the role (no answer)", ex);
        }
    }

    @Override
    public void removeRole(String token, UUID userId, String roleName) {
        deleteIgnoringMissing(authorization("/api/v1/users/" + userId + "/roles/" + roleIdByName(token, roleName)), token);
    }

    @SuppressWarnings("unchecked")
    private long roleIdByName(String token, String roleName) {
        List<Map<String, Object>> roles = exchangeIdempotent(HttpMethod.GET, authorization("/api/v1/roles"), token, List.class).getBody();
        if (roles != null) {
            for (Map<String, Object> role : roles) {
                if (roleName.equalsIgnoreCase(String.valueOf(role.get("roleName")).trim())) return asLong(role, "roleId");
            }
        }
        throw new OnboardingUnavailableException("Role " + roleName + " is not configured");
    }

    /** A client error from the other service keeps its status and reason; anything else is 503. */
    private static RuntimeException downstream(String step, HttpStatusCodeException ex) {
        int status = ex.getStatusCode().value();
        if (status == 400 || status == 403 || status == 404 || status == 409) {
            String detail = ex.getResponseBodyAsString();
            return new DownstreamRejectedException(status, "Could not " + step
                    + (detail == null || detail.isBlank() ? "" : ": " + detail.substring(0, Math.min(detail.length(), 300))));
        }
        return unavailable(step, ex);
    }

    @Override
    public void deleteSchool(String token, long schoolId) {
        deleteIgnoringMissing(academic("/api/v1/schools/" + schoolId), token);
    }

    @SuppressWarnings("unchecked")
    private long adminRoleId(String token) {
        List<Map<String, Object>> roles = exchangeIdempotent(HttpMethod.GET, authorization("/api/v1/roles"), token, List.class).getBody();
        if (roles != null) {
            for (Map<String, Object> role : roles) {
                String name = String.valueOf(role.get("roleName")).trim().toLowerCase(Locale.ROOT).replace('_', ' ');
                if (ADMIN_ROLE_NAMES.contains(name)) return asLong(role, "roleId");
            }
        }
        throw new OnboardingUnavailableException("Administrator role is not configured");
    }

    /** GET/DELETE are safe to repeat: one retry when the service did not answer in time. */
    private <T> ResponseEntity<T> exchangeIdempotent(HttpMethod method, String url, String token, Class<T> type) {
        try {
            return exchange(method, url, token, null, type);
        } catch (ResourceAccessException timeout) {
            return exchange(method, url, token, null, type);
        }
    }

    /** DELETE for rollbacks: already gone (404) is the outcome we want. */
    private void deleteIgnoringMissing(String url, String token) {
        try {
            exchangeIdempotent(HttpMethod.DELETE, url, token, Void.class);
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode().value() != 404) throw ex;
        }
    }

    private <T> ResponseEntity<T> exchange(HttpMethod method, String url, String token, Object body, Class<T> type) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(url, method, new HttpEntity<>(body, headers), type);
    }

    private String academic(String path) {
        return trimSlash(properties.getAcademicUrl()) + path;
    }

    private String authorization(String path) {
        return trimSlash(properties.getAuthorizationUrl()) + path;
    }

    private static String trimSlash(String base) {
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private static void putIfPresent(Map<String, Object> body, String key, String value) {
        if (value != null && !value.isBlank()) body.put(key, value.trim());
    }

    private static long asLong(Map<String, Object> body, String key) {
        Object value = body == null ? null : body.get(key);
        if (value instanceof Number n) return n.longValue();
        throw new OnboardingUnavailableException("Unexpected response from downstream service");
    }

    private static OnboardingUnavailableException unavailable(String step, HttpStatusCodeException ex) {
        return new OnboardingUnavailableException("Could not " + step + " (downstream status " + ex.getStatusCode().value() + ")", ex);
    }
}
