package com.faceattend_edu.attendance_service.infrastructure.web.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Exige Bearer con sessionId opaco de identity en todo /api/** (salud/docs públicos).
 * Valida la sesión contra identity, resuelve roles y evalúa el permiso requerido
 * contra authorization. Propaga X-User-Id / X-User-Roles.
 *
 * <p>Lecturas exigen attendance.record:read; escrituras attendance.record:write;
 * la revisión de justificaciones exige attendance.justification:approve y radicar
 * justificaciones o soportes exige attendance.justification:request; el catálogo de
 * tipos de justificación exige configuration:manage.</p>
 *
 * <p>Duplicado intencional por MS: el repo no tiene módulo compartido.
 * Futuro ADR-007 (JWT RS256 emitido por identity): aceptar JWT firmado aquí
 * como alternativa al sessionId opaco.</p>
 */
@Component
public class AuthTokenFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthTokenFilter.class);

    private static final List<String> PUBLIC_PREFIXES = List.of(
            "/health", "/api/v1/health", "/api/health",
            "/actuator/", "/v3/api-docs", "/swagger-ui", "/swagger-ui.html");

    private final RestTemplate restTemplate;
    private final ObjectProvider<CallerScopeResolver> scopeResolver;
    private final ObjectProvider<CallerSchoolResolver> schoolResolver;

    /**
    * Caché positiva de autenticación (TTL corto). Cada request autenticado
    * costaba 2-3 introspecciones secuenciales (sesión + roles + evaluate);
    * bajo fan-out del frontend eso saturaba identity/authorization y Kong
    * respondía 503 "Cannot verify session". Solo se cachean resultados
    * POSITIVOS: cualquier fallo se revalida en vivo (fail-secure). Ventana
    * de revocación/logout: AUTH_CACHE_TTL_MS.
    */
    private static final long AUTH_CACHE_TTL_MS = 10_000;
    private static final int AUTH_CACHE_MAX_ENTRIES = 5_000;
    private final java.util.Map<String, CachedSession> sessionCache = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, CachedEvaluation> evaluationCache = new java.util.concurrent.ConcurrentHashMap<>();

    private record CachedSession(String userId, java.util.List<String> roles, long expiresAt) {}
    private record CachedEvaluation(boolean allowed, long expiresAt) {}

    private CachedSession cachedSession(String rawToken) {
        CachedSession hit = sessionCache.get(rawToken);
        if (hit == null) return null;
        if (hit.expiresAt() <= System.currentTimeMillis()) { sessionCache.remove(rawToken); return null; }
        return hit;
    }

    private void storeSession(String rawToken, String userId, java.util.List<String> roles) {
        if (sessionCache.size() > AUTH_CACHE_MAX_ENTRIES) sessionCache.clear();
        sessionCache.put(rawToken, new CachedSession(userId, java.util.List.copyOf(roles), System.currentTimeMillis() + AUTH_CACHE_TTL_MS));
    }

    private boolean cachedEvaluate(String rawToken, String userId, String permission) {
        String key = rawToken + "\n" + userId + "\n" + permission;
        CachedEvaluation hit = evaluationCache.get(key);
        long now = System.currentTimeMillis();
        if (hit != null) {
            if (hit.expiresAt() > now) return hit.allowed();
            evaluationCache.remove(key);
        }
        boolean allowed = evaluate(rawToken, userId, permission);
        if (allowed) {
            if (evaluationCache.size() > AUTH_CACHE_MAX_ENTRIES) evaluationCache.clear();
            evaluationCache.put(key, new CachedEvaluation(true, now + AUTH_CACHE_TTL_MS));
        }
        return allowed;
    }

    @Value("${faceattend.auth.identity-url:http://localhost:8081}")
    private String identityUrl;

    @Value("${faceattend.auth.authorization-url:http://localhost:8082}")
    private String authorizationUrl;

    public AuthTokenFilter(ObjectProvider<CallerScopeResolver> scopeResolver, ObjectProvider<CallerSchoolResolver> schoolResolver) {
        this.scopeResolver = scopeResolver;
        this.schoolResolver = schoolResolver;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || isPublic(path)) {
            chain.doFilter(request, response);
            return;
        }

        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.regionMatches(true, 0, "Bearer ", 0, 7)) {
            deny(response, HttpServletResponse.SC_UNAUTHORIZED, "Missing bearer token", path);
            return;
        }
        UUID sessionId;
        String rawToken;
        try {
            rawToken = auth.substring(7).trim();
            sessionId = UUID.fromString(rawToken);
        } catch (IllegalArgumentException e) {
            deny(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid token format", path);
            return;
        }

        CachedSession cached = cachedSession(rawToken);
        final String caller;
        final List<String> roles;
        if (cached != null) {
            caller = cached.userId();
            roles = cached.roles();
        } else {
            Map<?, ?> session = fetchSession(rawToken, sessionId);
            if (session == null || !"Active".equals(session.get("sessionStatus"))) {
                deny(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired session", path);
                return;
            }
            Object userId = session.get("userId");
            if (userId == null) {
                deny(response, HttpServletResponse.SC_UNAUTHORIZED, "Session without user", path);
                return;
            }
            caller = String.valueOf(userId);
            List<String> fetched = fetchRoles(rawToken, caller);
            if (fetched == null) {
                deny(response, HttpServletResponse.SC_UNAUTHORIZED, "Cannot verify user roles", path);
                return;
            }
            roles = fetched;
            storeSession(rawToken, caller, roles);
        }

        String required = requiredPermission(request.getMethod(), path);
        if (required != null && !cachedEvaluate(rawToken, caller, required)) {
            deny(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden: requires " + required, path);
            return;
        }

        if (path.startsWith("/api/v1/justification-types")) {
            // El catálogo de tipos no es "común a todos": los globales (school_id
            // NULL) sí lo son, pero los propios de una sede solo los ve/gestiona
            // esa sede (y Super Administrador). CallerScopeResolver no sirve aquí
            // porque resuelve actores, no la sede propia del llamante.
            CallerSchoolResolver resolver = schoolResolver.getIfAvailable();
            if (resolver != null) {
                CallerSchoolResolver.CallerSchool callerSchool;
                try {
                    callerSchool = resolver.resolve(caller, roles, rawToken);
                } catch (RuntimeException e) {
                    log.warn("AuthTokenFilter: caller school for {} failed: {}", caller, e.getMessage());
                    deny(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Cannot resolve caller school", path);
                    return;
                }
                request.setAttribute(CallerSchoolContext.ATTRIBUTE, callerSchool);
            }
        } else {
            // Quien no es administrador solo ve los registros de su alcance (ActorScope).
            CallerScopeResolver resolver = scopeResolver.getIfAvailable();
            if (resolver != null) {
                Set<Long> scope;
                try {
                    scope = resolver.resolve(caller, roles, rawToken);
                } catch (RuntimeException e) {
                    log.warn("AuthTokenFilter: actor scope for {} failed: {}", caller, e.getMessage());
                    deny(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Cannot resolve actor scope", path);
                    return;
                }
                if (scope != null) request.setAttribute(ActorScope.ATTRIBUTE, scope);
            }
        }

        request.setAttribute("X-User-Id", caller);
        request.setAttribute("X-User-Roles", roles);
        response.setHeader("X-User-Roles", String.join(",", roles));
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                caller, null, roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r.toUpperCase())).toList());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    static String requiredPermission(String method, String path) {
        if (method.equalsIgnoreCase("GET")) return "attendance.record:read";
        if (path.contains("/justifications/") && path.endsWith("/review")) return "attendance.justification:approve";
        // El catálogo de tipos es configuración de la sede: solo Administrador.
        if (path.startsWith("/api/v1/justification-types")) return "configuration:manage";
        // Aprendiz radica sus propias justificaciones y soportes (HU-JUS-001) sin poder escribir asistencia.
        if (method.equalsIgnoreCase("POST")
                && (path.equals("/api/v1/justifications") || path.equals("/api/v1/supporting-documents"))) {
            return "attendance.justification:request";
        }
        return "attendance.record:write";
    }

    private HttpHeaders bearerHeaders(String rawToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(rawToken);
        return headers;
    }

    /**
     * Un reintento tras una pausa corta: justo después de `docker compose up`,
     * identity/authorization pueden pasar su healthcheck mientras su pool de
     * conexiones a Postgres todavía calienta, y esa primera llamada lenta
     * superaba el timeout y denegaba sesiones válidas con 401/403 silenciosos
     * (sin ningún log que lo explicara).
     */
    private <T> T withRetry(Supplier<T> call, T onFailure, String what) {
        try {
            return call.get();
        } catch (Exception first) {
            try {
                Thread.sleep(250);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return onFailure;
            }
            try {
                return call.get();
            } catch (Exception second) {
                log.warn("AuthTokenFilter: {} failed twice: {}", what, second.getMessage());
                return onFailure;
            }
        }
    }

    @SuppressWarnings("unchecked")
    private Map<?, ?> fetchSession(String rawToken, UUID sessionId) {
        return withRetry(() -> {
            ResponseEntity<Map> response = restTemplate.exchange(
                    identityUrl + "/api/v1/sessions/" + sessionId, HttpMethod.GET,
                    new HttpEntity<>(bearerHeaders(rawToken)), Map.class);
            return response.getBody();
        }, null, "fetchSession(" + sessionId + ")");
    }

    private List<String> fetchRoles(String rawToken, String userId) {
        return withRetry(() -> {
            ResponseEntity<List> response = restTemplate.exchange(
                    authorizationUrl + "/api/v1/users/" + userId + "/roles", HttpMethod.GET,
                    new HttpEntity<>(bearerHeaders(rawToken)), List.class);
            List<?> raw = response.getBody();
            if (raw == null) return null;
            List<String> roles = new ArrayList<>();
            for (Object item : raw) {
                if (item instanceof Map<?, ?> map) {
                    Object name = map.get("roleName") != null ? map.get("roleName") : map.get("role_name");
                    if (name != null) roles.add(String.valueOf(name));
                }
            }
            return roles;
        }, null, "fetchRoles(" + userId + ")");
    }

    @SuppressWarnings("unchecked")
    private boolean evaluate(String rawToken, String userId, String permission) {
        return withRetry(() -> {
            ResponseEntity<Map> response = restTemplate.exchange(
                    authorizationUrl + "/api/v1/auth/evaluate?userId=" + userId + "&permission=" + permission,
                    HttpMethod.GET, new HttpEntity<>(bearerHeaders(rawToken)), Map.class);
            Map<?, ?> result = response.getBody();
            return result != null && Boolean.TRUE.equals(result.get("allowed"));
        }, false, "evaluate(" + userId + ", " + permission + ")");
    }

    private boolean isPublic(String path) {
        for (String prefix : PUBLIC_PREFIXES) {
            if (path.equals(prefix) || path.startsWith(prefix)) return true;
        }
        return false;
    }

    private void deny(HttpServletResponse response, int status, String message, String path) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        String safe = message.replace("\"", "'");
        String body = "{\"status\":" + status + ",\"error\":\""
                + (status == 401 ? "Unauthorized" : status == 503 ? "Service Unavailable" : "Forbidden") + "\",\"message\":\"" + safe
                + "\",\"path\":\"" + path.replace("\"", "'") + "\"}";
        response.getWriter().write(body);
    }
}
