package com.faceattend_edu.attendance_service.infrastructure.web.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Actores académicos cuyos registros puede ver quien llama. Super Administrador:
 * todos ({@code null}, sin sede propia). Administrador: solo los actores de su
 * propia sede (resuelta vía su propio academic_actor), nunca los de otras
 * instituciones. Instructor: los suyos y los aprendices activos de las fichas
 * donde dicta. Aprendiz: solo los suyos. Se calcula con el bearer del llamante
 * (identity → academic → scheduling) y se cachea 60 s. Duplicado intencional por
 * MS, igual que AuthTokenFilter (01-ms-identity tiene su par para personas).
 */
@Component
public class CallerScopeResolver {

    static final String SUPER_ADMIN_ROLE = "Super Administrador";
    static final String SCHOOL_ADMIN_ROLE = "Administrador";
    private static final long TTL_MS = 60_000;
    private static final int ACTOR_PAGE_SIZE = 100;

    private record Cached(Set<Long> actorIds, long expiresAt) {}

    private final RestTemplate restTemplate;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    @Value("${faceattend.auth.identity-url:http://localhost:8081}")
    private String identityUrl;

    @Value("${faceattend.auth.academic-url:http://localhost:8083}")
    private String academicUrl;

    @Value("${faceattend.auth.scheduling-url:http://localhost:8084}")
    private String schedulingUrl;

    public CallerScopeResolver() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * @return {@code null} sin restricción (administrador) o el conjunto de actores visibles.
     * @throws RuntimeException si identity/academic/scheduling no responden (el filtro responde 503).
     */
    public Set<Long> resolve(String userId, List<String> roles, String token) {
        if (roles.contains(SUPER_ADMIN_ROLE)) return null;
        Cached hit = cache.get(userId);
        if (hit != null && hit.expiresAt() > System.currentTimeMillis()) return hit.actorIds();

        Map<?, ?> user = getMap(identityUrl + "/api/v1/users/" + userId, token);
        Object rawPersonId = user == null ? null : user.get("personId");
        String personId = rawPersonId == null ? null : String.valueOf(rawPersonId);
        Set<Long> actors = new HashSet<>();
        if (personId == null) return Set.of();
        // ?personId= filtra en academic: el listado completo con ?limit se corta en 100 filas y el
        // actor del llamante quedaba fuera (el instructor veía un alcance vacío).
        String byPerson = academicUrl + "/api/v1/academic-actors?personId=" + URLEncoder.encode(personId, StandardCharsets.UTF_8);
        for (Map<?, ?> actor : getList(byPerson, token)) {
            if (personId.equalsIgnoreCase(String.valueOf(actor.get("personId")))) {
                actors.add(toLong(actor.get("academicActorId")));
            }
        }

        if (roles.contains(SCHOOL_ADMIN_ROLE)) {
            // Administrador de sede: su propia sede, nunca otras instituciones
            // (a diferencia de Super Administrador, que ve todo).
            // La sede propia se deduce de la lista completa (no solo del actor del llamante).
            List<Map<?, ?>> allActors = allAcademicActors(token);
            Set<String> ownSchools = new HashSet<>();
            for (Map<?, ?> actor : allActors) {
                if (actors.contains(toLong(actor.get("academicActorId"))) && actor.get("schoolId") != null) {
                    ownSchools.add(String.valueOf(actor.get("schoolId")));
                }
            }
            Set<Long> visibleForAdmin = new HashSet<>();
            if (!ownSchools.isEmpty()) {
                for (Map<?, ?> actor : allActors) {
                    if (actor.get("schoolId") != null && ownSchools.contains(String.valueOf(actor.get("schoolId")))) {
                        visibleForAdmin.add(toLong(actor.get("academicActorId")));
                    }
                }
            } else {
                // Sin sede propia (no debería ocurrir para un Administrador): falla
                // seguro, solo sus propios actores en vez de caer a "ver todo".
                visibleForAdmin.addAll(actors);
            }
            visibleForAdmin.remove(null);
            Set<Long> adminScope = Set.copyOf(visibleForAdmin);
            cache.put(userId, new Cached(adminScope, System.currentTimeMillis() + TTL_MS));
            return adminScope;
        }

        Set<Long> visible = new HashSet<>(actors);
        for (Long actorId : actors) {
            for (Map<?, ?> block : getList(schedulingUrl + "/api/v1/schedule-blocks?instructorActorId=" + actorId, token)) {
                for (Map<?, ?> enrollment : getList(academicUrl + "/api/v1/cohorts/" + block.get("cohortId") + "/enrollments", token)) {
                    if ("Active".equals(enrollment.get("enrollmentStatus"))) visible.add(toLong(enrollment.get("academicActorId")));
                }
            }
        }
        visible.remove(null);
        Set<Long> scope = Set.copyOf(visible);
        cache.put(userId, new Cached(scope, System.currentTimeMillis() + TTL_MS));
        return scope;
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
        return TransientRetry.call(() -> restTemplate.exchange(url, HttpMethod.GET, auth(token), Map.class).getBody());
    }

    @SuppressWarnings("unchecked")
    /** The academic service caps every page at ACTOR_PAGE_SIZE, so the full list is walked page by page. */
    private List<Map<?, ?>> allAcademicActors(String token) {
        List<Map<?, ?>> all = new java.util.ArrayList<>();
        for (int offset = 0; ; offset += ACTOR_PAGE_SIZE) {
            List<Map<?, ?>> page = getList(academicUrl + "/api/v1/academic-actors?limit=" + ACTOR_PAGE_SIZE + "&offset=" + offset, token);
            all.addAll(page);
            if (page.size() < ACTOR_PAGE_SIZE) return all;
        }
    }

    protected List<Map<?, ?>> getList(String url, String token) {
        List<Map<?, ?>> body = TransientRetry.call(
                () -> restTemplate.exchange(url, HttpMethod.GET, auth(token), List.class).getBody());
        return body == null ? List.of() : body;
    }
}
