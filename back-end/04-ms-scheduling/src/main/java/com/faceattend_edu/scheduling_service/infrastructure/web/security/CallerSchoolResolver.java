package com.faceattend_edu.scheduling_service.infrastructure.web.security;

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
 * The school a caller may manage: environments, schedule blocks and class
 * sessions all trace back to a school (environment.school_id directly; the
 * rest through environment). Super Administrador (no school of its own) is
 * unrestricted; everyone else is confined to their own school, resolved via
 * their own academic_actor — never trusted from the request. `ownActorId` is
 * the caller's own academic_actor in that school, used to stamp
 * class_session.opened_by/closed_by instead of trusting the request body.
 * Duplicated per MS, same pattern as 01-identity/05-attendance.
 */
@Component
public class CallerSchoolResolver {

    public record CallerSchool(boolean isSuperAdmin, Integer schoolId, Long ownActorId) {
        static final CallerSchool SUPER_ADMIN = new CallerSchool(true, null, null);
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
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    /** @throws RuntimeException if identity/academic do not respond (the controller answers 503). */
    public CallerSchool resolve(String userId, List<String> roles, String token) {
        if (roles.contains(SUPER_ADMIN_ROLE)) return CallerSchool.SUPER_ADMIN;

        Cached hit = cache.get(userId);
        if (hit != null && hit.expiresAt() > System.currentTimeMillis()) return hit.value();

        Map<?, ?> user = getMap(identityUrl + "/api/v1/users/" + userId, token);
        String personId = user == null ? null : String.valueOf(user.get("personId"));
        CallerSchool resolved = new CallerSchool(false, null, null);
        if (personId != null && !"null".equals(personId)) {
            for (Map<?, ?> actor : getList(academicUrl + "/api/v1/academic-actors?personId=" + personId, token)) {
                Object schoolId = actor.get("schoolId");
                if (schoolId instanceof Number n) {
                    resolved = new CallerSchool(false, n.intValue(), toLong(actor.get("academicActorId")));
                    break;
                }
            }
        }
        cache.put(userId, new Cached(resolved, System.currentTimeMillis() + TTL_MS));
        return resolved;
    }

    private static Long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : null;
    }

    private HttpEntity<Void> auth(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    protected Map<?, ?> getMap(String url, String token) {
        return restTemplate.exchange(url, HttpMethod.GET, auth(token), Map.class).getBody();
    }

    @SuppressWarnings("unchecked")
    protected List<Map<?, ?>> getList(String url, String token) {
        List<Map<?, ?>> body = restTemplate.exchange(url, HttpMethod.GET, auth(token), List.class).getBody();
        return body == null ? List.of() : body;
    }
}
