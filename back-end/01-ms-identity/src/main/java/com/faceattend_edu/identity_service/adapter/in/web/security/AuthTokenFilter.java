package com.faceattend_edu.identity_service.adapter.in.web.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.domain.model.User;
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
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Exige Bearer con sessionId opaco en todo /api/** salvo login/logout/me (bootstrap).
 * Valida la sesión contra el propio store vía identity, resuelve roles y evalúa
 * el permiso requerido contra authorization. Propaga X-User-Id / X-User-Roles.
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

    /** Atributo que marca un PUT sobre la propia persona hecho sin identity.person:write. */
    public static final String SELF_EDIT_ATTRIBUTE = "identity.selfEdit";
    /** Set<UUID> de personas visibles para quien no es administrador (listado de /persons). */
    public static final String PERSON_SCOPE_ATTRIBUTE = "identity.personScope";

    private static final Pattern PERSON_ITEM = Pattern.compile("^/api/v1/persons/([0-9a-fA-F-]{36})$");
    private static final Pattern USER_ITEM = Pattern.compile("^/api/v1/users/([0-9a-fA-F-]{36})$");
    private static final Pattern USER_SESSIONS = Pattern.compile("^/api/v1/sessions/user/([0-9a-fA-F-]{36})$");
    private static final String WRITE = "identity.person:write";

    private final RestTemplate restTemplate;
    // Perezoso: los tests @WebMvcTest cargan el filtro sin la capa de persistencia.
    private final ObjectProvider<LoadUserPort> loadUserPort;
    private final ObjectProvider<CallerScopeResolver> scopeResolver;

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

    public AuthTokenFilter(ObjectProvider<LoadUserPort> loadUserPort, ObjectProvider<CallerScopeResolver> scopeResolver) {
        this.loadUserPort = loadUserPort;
        this.scopeResolver = scopeResolver;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || isPublic(request.getMethod(), path)) {
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

        String required = requiredPermission(request.getMethod(), path, caller);
        // Cada rol edita sus propios datos personales (perfil) sin identity.person:write.
        if (WRITE.equals(required) && isOwnPerson(request.getMethod(), path, caller)) {
            required = "identity.person:read";
            request.setAttribute(SELF_EDIT_ATTRIBUTE, Boolean.TRUE);
        }
        if (required != null && !cachedEvaluate(rawToken, caller, required)) {
            deny(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden: requires " + required, path);
            return;
        }

        // Una cuenta ajena exige alcance; la propia no — y el guard de academic
        // resuelve la persona del llamante justo con esa auto-llamada: sin esta
        // excepción la resolución de alcance (→ academic-actors → identity
        // users/{id}) se llama a sí misma hasta agotar timeouts (503).
        Matcher userItemPath = USER_ITEM.matcher(path);
        boolean ownUserItem = userItemPath.matches() && userItemPath.group(1).equalsIgnoreCase(caller);
        if (request.getMethod().equalsIgnoreCase("GET")
                && (path.startsWith("/api/v1/persons") || path.equals("/api/v1/users")
                        || (userItemPath.matches() && !ownUserItem))
                && !applyPersonScope(request, response, path, caller, roles, rawToken)) {
            return;
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

    private boolean isPublic(String method, String path) {
        for (String prefix : PUBLIC_PREFIXES) {
            if (path.equals(prefix) || path.startsWith(prefix)) return true;
        }
        // Bootstrap: login/logout/me públicos; el resto de /api/** exige sesión.
        if (path.equals("/api/v1/auth/login") && method.equalsIgnoreCase("POST")) return true;
        if (path.equals("/api/v1/auth/logout") && method.equalsIgnoreCase("POST")) return true;
        // Rotación de sesión (refresh token): el sessionId viejo viaja en el cuerpo
        // y se cierra al emitir el nuevo, por eso no exige bearer previo.
        if (path.equals("/api/v1/auth/refresh") && method.equalsIgnoreCase("POST")) return true;
        // Recuperación de contraseña: todavía no hay sesión; la autorización la da
        // el reto verificado que vive en el almacén de códigos.
        if (path.equals("/api/v1/auth/forgot-password") && method.equalsIgnoreCase("POST")) return true;
        if (path.equals("/api/v1/auth/verify-code") && method.equalsIgnoreCase("POST")) return true;
        if (path.equals("/api/v1/auth/reset-password") && method.equalsIgnoreCase("POST")) return true;
        if (path.equals("/api/v1/auth/me") && method.equalsIgnoreCase("GET")) return true;
        // Lectura de sesión por UUID: la usa el propio filtro (fetchSession) en cada
        // MS. Sin bypass, la validación se llamaría a sí misma por HTTP en bucle
        // hasta agotar timeouts y toda petición autenticada terminaría en 401.
        // El UUID es opaco e indivinable (equivale al bearer); el listado POST/DELETE
        // y GET /api/v1/sessions (lista) siguen protegidos.
        // Solo un segmento: /sessions/user/{id} devuelve session ids (bearer) ajenos.
        return method.equalsIgnoreCase("GET") && path.startsWith("/api/v1/sessions/")
                && path.indexOf("/", "/api/v1/sessions/".length()) < 0;
    }

    static String requiredPermission(String method, String path, String caller) {
        // Cambio de la propia contraseña: basta la sesión (la valida el caso de uso).
        if (method.equalsIgnoreCase("POST") && path.equals("/api/v1/auth/change-password")) return null;
        if (!method.equalsIgnoreCase("GET")) return WRITE;
        // Listados completos de cuentas y sesiones: solo administración.
        if (path.equals("/api/v1/users") || path.equals("/api/v1/sessions")) return WRITE;
        // Una cuenta ajena solo la consulta administración.
        Matcher user = USER_ITEM.matcher(path);
        if (user.matches() && !user.group(1).equalsIgnoreCase(caller)) return WRITE;
        Matcher own = USER_SESSIONS.matcher(path);
        if (own.matches() && !own.group(1).equalsIgnoreCase(caller)) return WRITE;
        return "identity.person:read";
    }

    /**
     * Admin ve todas las personas; el resto solo las de su alcance (CallerScopeResolver).
     * Devuelve false si ya respondió (403/503).
     */
    private boolean applyPersonScope(HttpServletRequest request, HttpServletResponse response, String path,
                                     String caller, List<String> roles, String rawToken) throws IOException {
        CallerScopeResolver resolver = scopeResolver.getIfAvailable();
        if (resolver == null) return true;
        CallerScopeResolver.Scope scope;
        try {
            scope = resolver.resolve(caller, roles, rawToken);
        } catch (RuntimeException e) {
            log.warn("AuthTokenFilter: person scope for {} failed: {}", caller, e.getMessage());
            deny(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Cannot resolve person scope", path);
            return false;
        }
        if (scope.all()) return true;
        Matcher item = PERSON_ITEM.matcher(path);
        if (item.matches() && !scope.allows(UUID.fromString(item.group(1)))) {
            deny(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden: person outside your scope", path);
            return false;
        }
        Matcher userItem = USER_ITEM.matcher(path);
        if (userItem.matches() && !userItem.group(1).equalsIgnoreCase(caller)) {
            // Una cuenta ajena se ve solo si su persona cae en el alcance del llamante.
            LoadUserPort port = loadUserPort.getIfAvailable();
            User target = port == null ? null : port.loadUser(UUID.fromString(userItem.group(1)));
            UUID personId = target == null || target.getPersonId() == null ? null
                    : target.getPersonId().getPersonId();
            if (personId == null || !scope.allows(personId)) {
                deny(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden: user outside your scope", path);
                return false;
            }
        }
        request.setAttribute(PERSON_SCOPE_ATTRIBUTE, scope.personIds());
        return true;
    }

    private boolean isOwnPerson(String method, String path, String caller) {
        Matcher m = PERSON_ITEM.matcher(path);
        if (!method.equalsIgnoreCase("PUT") || !m.matches()) return false;
        try {
            LoadUserPort port = loadUserPort.getIfAvailable();
            User user = port == null ? null : port.loadUser(UUID.fromString(caller));
            return user != null && user.getPersonId() != null && user.getPersonId().getPersonId() != null
                    && user.getPersonId().getPersonId().toString().equalsIgnoreCase(m.group(1));
        } catch (IllegalArgumentException e) {
            return false;
        }
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
