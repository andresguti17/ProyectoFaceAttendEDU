package com.faceattend_edu.shared.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Validación de sesión compartida por los servicios Java: el bearer es el sessionId
 * opaco de identity; la sesión se lee en identity, los roles en authorization y cada
 * permiso en /auth/evaluate, con el token del propio llamante.
 *
 * <p>Cada servicio conserva en su AuthTokenFilter qué permiso exige cada ruta y su
 * alcance (sede, actores, personas); aquí solo vive lo que era idéntico en los cuatro.</p>
 *
 * <p>Caché positiva de TTL corto: cada request costaba 2-3 llamadas en serie y, con
 * el fan-out del frontend, saturaba identity/authorization. Un fallo nunca se cachea
 * (se revalida en vivo); la ventana de revocación/logout es {@link #CACHE_TTL_MS}.</p>
 */
public class SessionAuthClient {

    private static final Logger log = LoggerFactory.getLogger(SessionAuthClient.class);

    /** Salud: nunca pide sesión (la documentación de springdoc se abre aparte, solo si está activada). */
    public static final List<String> PUBLIC_PREFIXES = List.of(
            "/health", "/api/v1/health", "/api/health", "/actuator/health");

    static final long CACHE_TTL_MS = 10_000;
    private static final int CACHE_MAX_ENTRIES = 5_000;

    /** Quien llama, ya validado. {@code token} es el sessionId tal como llegó. */
    public record Caller(String userId, List<String> roles, String token) {}

    /** Resultado de {@link #authenticate}: el llamante, o el mensaje del 401. */
    public record AuthResult(Caller caller, String denial) {
        public boolean authenticated() {
            return caller != null;
        }
    }

    /** {@code roles} es null cuando solo se validó la sesión ({@link #authenticateSession}). */
    private record CachedSession(String userId, List<String> roles, long expiresAt) {}

    private final RestTemplate restTemplate;
    private final String identityUrl;
    private final String authorizationUrl;
    private final Map<String, CachedSession> sessionCache = new ConcurrentHashMap<>();
    private final Map<String, Long> allowedUntil = new ConcurrentHashMap<>();

    public SessionAuthClient(String identityUrl, String authorizationUrl) {
        this(defaultRestTemplate(), identityUrl, authorizationUrl);
    }

    public SessionAuthClient(RestTemplate restTemplate, String identityUrl, String authorizationUrl) {
        this.restTemplate = restTemplate;
        this.identityUrl = identityUrl;
        this.authorizationUrl = authorizationUrl;
    }

    private static RestTemplate defaultRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        return new RestTemplate(factory);
    }

    /** Valida el header Authorization: sesión activa en identity y roles en authorization. */
    public AuthResult authenticate(String authorizationHeader) {
        AuthResult session = authenticateSession(authorizationHeader);
        if (!session.authenticated()) return session;
        String token = session.caller().token();
        String caller = session.caller().userId();

        CachedSession cached = sessionCache.get(token);
        if (cached != null && cached.roles() != null && cached.expiresAt() > System.currentTimeMillis()) {
            return new AuthResult(new Caller(caller, cached.roles(), token), null);
        }
        List<String> roles = fetchRoles(token, caller);
        if (roles == null) {
            return new AuthResult(null, "Cannot verify user roles");
        }
        remember(token, caller, List.copyOf(roles));
        return new AuthResult(new Caller(caller, List.copyOf(roles), token), null);
    }

    /**
     * Solo la sesión activa en identity, sin pedir roles (el Caller sale con roles vacíos).
     * Lo usa authorization para sus propias primitivas (roles y evaluate), que
     * {@link #authenticate} de cualquier servicio consulta: pedir roles desde ahí
     * volvería a llamar a authorization en bucle.
     */
    public AuthResult authenticateSession(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return new AuthResult(null, "Missing bearer token");
        }
        String token = authorizationHeader.substring(7).trim();
        UUID sessionId;
        try {
            sessionId = UUID.fromString(token);
        } catch (IllegalArgumentException e) {
            return new AuthResult(null, "Invalid token format");
        }

        CachedSession cached = sessionCache.get(token);
        if (cached != null && cached.expiresAt() > System.currentTimeMillis()) {
            return new AuthResult(new Caller(cached.userId(), List.of(), token), null);
        }
        if (cached != null) sessionCache.remove(token);

        Map<?, ?> session = fetchSession(token, sessionId);
        if (session == null || !"Active".equals(session.get("sessionStatus"))) {
            return new AuthResult(null, "Invalid or expired session");
        }
        Object userId = session.get("userId");
        if (userId == null) {
            return new AuthResult(null, "Session without user");
        }
        String caller = String.valueOf(userId);
        remember(token, caller, null);
        return new AuthResult(new Caller(caller, List.of(), token), null);
    }

    private void remember(String token, String userId, List<String> roles) {
        if (sessionCache.size() > CACHE_MAX_ENTRIES) sessionCache.clear();
        sessionCache.put(token, new CachedSession(userId, roles, System.currentTimeMillis() + CACHE_TTL_MS));
    }

    /** Pregunta a authorization si el llamante tiene el permiso (solo el "sí" se cachea). */
    public boolean isAllowed(Caller caller, String permission) {
        String key = caller.token() + "\n" + caller.userId() + "\n" + permission;
        long now = System.currentTimeMillis();
        Long until = allowedUntil.get(key);
        if (until != null) {
            if (until > now) return true;
            allowedUntil.remove(key);
        }
        boolean allowed = evaluate(caller.token(), caller.userId(), permission);
        if (allowed) {
            if (allowedUntil.size() > CACHE_MAX_ENTRIES) allowedUntil.clear();
            allowedUntil.put(key, now + CACHE_TTL_MS);
        }
        return allowed;
    }

    public static boolean isPublicPrefix(String path) {
        for (String prefix : PUBLIC_PREFIXES) {
            if (path.startsWith(prefix)) return true;
        }
        return false;
    }

    /**
     * Deja al llamante visible para los controladores (X-User-Id / X-User-Roles) y en el
     * SecurityContext. Quien llama limpia el contexto al terminar la cadena.
     */
    public static void propagate(HttpServletRequest request, HttpServletResponse response, Caller caller) {
        request.setAttribute("X-User-Id", caller.userId());
        request.setAttribute("X-User-Roles", caller.roles());
        response.setHeader("X-User-Roles", String.join(",", caller.roles()));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                caller.userId(), null,
                caller.roles().stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r.toUpperCase())).toList()));
    }

    /** Respuesta JSON de rechazo, con el mismo formato que usaban los cuatro filtros. */
    public static void deny(HttpServletResponse response, int status, String message, String path) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        String error = status == 401 ? "Unauthorized" : status == 503 ? "Service Unavailable" : "Forbidden";
        response.getWriter().write("{\"status\":" + status + ",\"error\":\"" + error + "\",\"message\":\""
                + message.replace("\"", "'") + "\",\"path\":\"" + path.replace("\"", "'") + "\"}");
    }

    private HttpEntity<Void> bearer(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    /**
     * Un reintento tras una pausa corta: justo después de `docker compose up`,
     * identity/authorization pasan su healthcheck mientras el pool de Postgres aún
     * calienta, y esa primera llamada lenta denegaba sesiones válidas sin ningún log.
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
                log.warn("SessionAuthClient: {} failed twice: {}", what, second.getMessage());
                return onFailure;
            }
        }
    }

    @SuppressWarnings("rawtypes")
    private Map<?, ?> fetchSession(String token, UUID sessionId) {
        return withRetry(() -> {
            ResponseEntity<Map> response = restTemplate.exchange(
                    identityUrl + "/api/v1/sessions/" + sessionId, HttpMethod.GET, bearer(token), Map.class);
            return response.getBody();
        }, null, "fetchSession(" + sessionId + ")");
    }

    @SuppressWarnings("rawtypes")
    private List<String> fetchRoles(String token, String userId) {
        return withRetry(() -> {
            ResponseEntity<List> response = restTemplate.exchange(
                    authorizationUrl + "/api/v1/users/" + userId + "/roles", HttpMethod.GET, bearer(token), List.class);
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

    @SuppressWarnings("rawtypes")
    private boolean evaluate(String token, String userId, String permission) {
        return withRetry(() -> {
            ResponseEntity<Map> response = restTemplate.exchange(
                    authorizationUrl + "/api/v1/auth/evaluate?userId=" + userId + "&permission=" + permission,
                    HttpMethod.GET, bearer(token), Map.class);
            Map<?, ?> result = response.getBody();
            return result != null && Boolean.TRUE.equals(result.get("allowed"));
        }, false, "evaluate(" + userId + ", " + permission + ")");
    }
}
