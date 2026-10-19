package com.faceattend_edu.attendance_service.infrastructure.web.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The school a caller may manage justification types for. Super Administrador
 * (no school of its own) is unrestricted; everyone else is confined to their
 * own school, resolved via their own academic_actor — never trusted from the
 * request. `justification_type.school_id` is nullable (NULL = global catalog,
 * shared by every school; only Super Administrador may touch those).
 * Duplicated per MS, same pattern as 01-identity/04-scheduling.
 */
@Component
public class CallerSchoolResolver {

    public record CallerSchool(boolean isSuperAdmin, Integer schoolId) {
        static final CallerSchool SUPER_ADMIN = new CallerSchool(true, null);
    }

    static final String SUPER_ADMIN_ROLE = "Super Administrador";
    private static final long TTL_MS = 30_000;

    private record Cached(CallerSchool value, long expiresAt) {}

    private final RestTemplate restTemplate;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    @Value("${faceattend.auth.identity-url:http://localhost:8081}")
    private String identityUrl;

    @Value("${faceattend.auth.academic-url:http://localhost:8083}")
    private String academicUrl;

    public CallerSchoolResolver() {
        this(buildRestTemplate());
    }

    CallerSchoolResolver(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    private static RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(8000);
        return new RestTemplate(factory);
    }

    /** @throws RuntimeException if identity/academic do not respond (the filter answers 503). */
    public CallerSchool resolve(String userId, List<String> roles, String token) {
        if (roles.contains(SUPER_ADMIN_ROLE)) return CallerSchool.SUPER_ADMIN;

        Cached hit = cache.get(userId);
        if (hit != null && hit.expiresAt() > System.currentTimeMillis()) return hit.value();

        Map<?, ?> user = getMap(identityUrl + "/api/v1/users/" + userId, token);
        String personId = user == null ? null : String.valueOf(user.get("personId"));
        CallerSchool resolved = new CallerSchool(false, null);
        if (personId != null && !"null".equals(personId)) {
            for (Map<?, ?> actor : getList(academicUrl + "/api/v1/academic-actors?personId=" + personId, token)) {
                Object schoolId = actor.get("schoolId");
                if (schoolId instanceof Number n) {
                    resolved = new CallerSchool(false, n.intValue());
                    break;
                }
            }
        }
        cache.put(userId, new Cached(resolved, System.currentTimeMillis() + TTL_MS));
        return resolved;
    }

    private HttpEntity<Void> auth(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    protected Map<?, ?> getMap(String url, String token) {
        return TransientRetry.call(() -> restTemplate.exchange(url, HttpMethod.GET, auth(token), Map.class).getBody());
    }

    @SuppressWarnings("unchecked")
    protected List<Map<?, ?>> getList(String url, String token) {
        List<Map<?, ?>> body = TransientRetry.call(
                () -> restTemplate.exchange(url, HttpMethod.GET, auth(token), List.class).getBody());
        return body == null ? List.of() : body;
    }
}
