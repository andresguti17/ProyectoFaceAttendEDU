package com.faceattend_edu.authorization_service.infrastructure.web.security;

import static com.faceattend_edu.shared.auth.SessionAuthClient.deny;
import com.faceattend_edu.authorization_service.domain.port.in.CheckPermissionUseCase;
import com.faceattend_edu.shared.auth.SessionAuthClient;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Exige Bearer con sessionId opaco de identity en todo /api/** (salud/docs públicos).
 * Valida la sesión contra identity, resuelve roles y evalúa el permiso requerido
 * contra /auth/evaluate. Propaga X-User-Id / X-User-Roles al request.
 *
 * <p>La validación de sesión vive en back-end/shared/auth-java (SessionAuthClient);
 * aquí quedan las reglas de permiso y alcance de este servicio.
 * Futuro ADR-007 (JWT RS256 emitido por identity): aceptar JWT firmado aquí
 * como alternativa al sessionId opaco.</p>
 */
@Component
public class AuthTokenFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthTokenFilter.class);

    private static final Pattern USER_ROLES_PATH = Pattern.compile(".*/users/([^/]+)/roles.*");

    /** Primitivas de lectura que {@link SessionAuthClient#authenticate} de todos los servicios consulta. */
    private static final Pattern PRIMITIVE_ROLES_PATH = Pattern.compile("^/api/v1/users/([^/]+)/roles$");
    private static final String PRIMITIVE_EVALUATE_PATH = "/api/v1/auth/evaluate";
    static final String MANAGE_PERMISSION = "configuration:manage";

    /** Any write on the role catalog itself, including a role's permission set. */
    private static final Pattern ROLE_CATALOG_WRITE_PATH = Pattern.compile("^(/api/v1)?/roles(/.*)?$");
    /** Any write on the permission catalog — what a permission even means. */
    private static final Pattern PERMISSION_CATALOG_WRITE_PATH = Pattern.compile("^(/api/v1)?/permissions(/.*)?$");

    /** Role name reserved for the unrestricted, school-less administrator. */
    static final String SUPER_ADMIN_ROLE = "Super Administrador";

    private final SessionAuthClient sessionAuth;
    private final ObjectProvider<CheckPermissionUseCase> checkPermission;

    public AuthTokenFilter(ObjectProvider<CheckPermissionUseCase> checkPermission,
                           @Value("${faceattend.auth.identity-url:http://localhost:8081}") String identityUrl,
                           @Value("${faceattend.auth.authorization-url:http://localhost:8082}") String authorizationUrl) {
        this.checkPermission = checkPermission;
        this.sessionAuth = new SessionAuthClient(identityUrl, authorizationUrl);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = SessionAuthClient.requestPath(request);
        if (!path.startsWith("/api/") || isPublic(path)) {
            chain.doFilter(request, response);
            return;
        }
        String primitiveTarget = primitiveTarget(request.getMethod(), path, request);
        if (primitiveTarget != null) {
            filterPrimitive(primitiveTarget, request, response, chain, path);
            return;
        }

        SessionAuthClient.AuthResult result = sessionAuth.authenticate(request.getHeader("Authorization"));
        if (!result.authenticated()) {
            deny(response, HttpServletResponse.SC_UNAUTHORIZED, result.denial(), path);
            return;
        }
        final String caller = result.caller().userId();
        final List<String> roles = result.caller().roles();
        final String rawToken = result.caller().token();

        // RBAC-on-RBAC (HU-IAM-003/010): who a user IS and what a role CAN do are
        // platform-level decisions. `configuration:manage` alone would let a
        // school Administrador (who also holds it) grant themselves or anyone
        // else the Super Administrador role, or rewrite the permission matrix —
        // so these writes require the role itself, not just the permission.
        if (requiresSuperAdminRole(request.getMethod(), path) && !roles.contains(SUPER_ADMIN_ROLE)) {
            deny(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden: requires " + SUPER_ADMIN_ROLE, path);
            return;
        }

        String required = requiredPermission(request.getMethod(), path, request, caller);
        if (required != null && !sessionAuth.isAllowed(result.caller(), required)) {
            deny(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden: requires " + required, path);
            return;
        }

        SessionAuthClient.propagate(request, response, result.caller());
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /**
     * Whether this write changes who a user IS (role assignment) or what a role
     * or permission CAN do (the RBAC catalog itself). Reserved for Super
     * Administrador: `configuration:manage` is held by a school Administrador
     * too, and the RBAC catalog is not scoped per school.
     */
    static boolean requiresSuperAdminRole(String method, String path) {
        if (method.equalsIgnoreCase("GET")) return false;
        return ROLE_CATALOG_WRITE_PATH.matcher(path).matches()
                || PERMISSION_CATALOG_WRITE_PATH.matcher(path).matches();
    }

    /**
     * Roles propios y evaluate propio solo exigen sesión válida;
     * ver roles ajenos o gestionar el catálogo exige configuration:manage.
     */
    String requiredPermission(String method, String path, HttpServletRequest request, String caller) {
        if (path.contains("/auth/evaluate")) {
            String target = request.getParameter("userId");
            if (target != null && !target.equals(caller)) return MANAGE_PERMISSION;
            return null;
        }
        Matcher matcher = USER_ROLES_PATH.matcher(path);
        if (matcher.matches()) {
            if (!matcher.group(1).equals(caller)) return MANAGE_PERMISSION;
            return null;
        }
        return MANAGE_PERMISSION;
    }

    /** El usuario que consulta una primitiva GET (roles o evaluate), o null si no es una. */
    static String primitiveTarget(String method, String path, HttpServletRequest request) {
        if (!method.equalsIgnoreCase("GET")) return null;
        if (path.equals(PRIMITIVE_EVALUATE_PATH)) {
            String target = request.getParameter("userId");
            return target != null ? target : "";
        }
        Matcher matcher = PRIMITIVE_ROLES_PATH.matcher(path);
        return matcher.matches() ? matcher.group(1) : null;
    }

    /**
     * Las primitivas ya no son públicas: exigen una sesión activa, y consultar a otro
     * usuario exige configuration:manage. Ambas cosas se resuelven sin volver a llamar a
     * este servicio por HTTP (la sesión solo en identity, el permiso en proceso), porque
     * {@link SessionAuthClient#authenticate} de cada servicio llega aquí para resolver roles.
     */
    private void filterPrimitive(String target, HttpServletRequest request, HttpServletResponse response,
                                 FilterChain chain, String path) throws ServletException, IOException {
        SessionAuthClient.AuthResult result = sessionAuth.authenticateSession(request.getHeader("Authorization"));
        if (!result.authenticated()) {
            deny(response, HttpServletResponse.SC_UNAUTHORIZED, result.denial(), path);
            return;
        }
        String caller = result.caller().userId();
        if (!sameUser(caller, target) && !hasPermissionInProcess(caller, MANAGE_PERMISSION)) {
            deny(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden: requires " + MANAGE_PERMISSION, path);
            return;
        }
        SessionAuthClient.propagate(request, response, result.caller());
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private boolean hasPermissionInProcess(String userId, String permission) {
        CheckPermissionUseCase useCase = checkPermission.getIfAvailable();
        if (useCase == null) return false;
        try {
            return useCase.hasPermission(UUID.fromString(userId), permission);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static boolean sameUser(String a, String b) {
        try {
            return UUID.fromString(a).equals(UUID.fromString(b));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private boolean isPublic(String path) {
        return SessionAuthClient.isPublicPrefix(path);
    }
}
