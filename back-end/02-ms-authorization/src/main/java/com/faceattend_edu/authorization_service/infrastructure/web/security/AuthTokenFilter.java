package com.faceattend_edu.authorization_service.infrastructure.web.security;

import static com.faceattend_edu.shared.auth.SessionAuthClient.deny;
import com.faceattend_edu.shared.auth.SessionAuthClient;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
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

    private static final Pattern USER_ROLES_PATH = Pattern.compile("^/api/v1/users/([^/]+)/roles$");

    /** Any write on the role catalog itself, including a role's permission set. */
    private static final Pattern ROLE_CATALOG_WRITE_PATH = Pattern.compile("^(/api/v1)?/roles(/.*)?$");
    /** Any write on the permission catalog — what a permission even means. */
    private static final Pattern PERMISSION_CATALOG_WRITE_PATH = Pattern.compile("^(/api/v1)?/permissions(/.*)?$");

    /** Role name reserved for the unrestricted, school-less administrator. */
    static final String SUPER_ADMIN_ROLE = "Super Administrador";

    private final SessionAuthClient sessionAuth;

    public AuthTokenFilter(@Value("${faceattend.auth.identity-url:http://localhost:8081}") String identityUrl,
                           @Value("${faceattend.auth.authorization-url:http://localhost:8082}") String authorizationUrl) {
        this.sessionAuth = new SessionAuthClient(identityUrl, authorizationUrl);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || SessionAuthClient.isPublicPrefix(path)) {
            chain.doFilter(request, response);
            return;
        }

        // The role lookups every service makes while authenticating its own callers land
        // here: checking them with authenticate() would ask for roles again, i.e. call this
        // very endpoint. They need the session only; whose roles may be read is decided below.
        SessionAuthClient.AuthResult result = isRoleLookup(request.getMethod(), path)
                ? sessionAuth.authenticateSession(request.getHeader("Authorization"))
                : sessionAuth.authenticate(request.getHeader("Authorization"));
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
     * Reading one's own roles or evaluating one's own permission only needs the session;
     * reading anyone else's, any write (assigning or removing roles, one's own included)
     * and the catalog need configuration:manage.
     */
    String requiredPermission(String method, String path, HttpServletRequest request, String caller) {
        if (isRoleLookup(method, path)) {
            Matcher roles = USER_ROLES_PATH.matcher(path);
            String target = roles.matches() ? roles.group(1) : request.getParameter("userId");
            return target == null || target.equalsIgnoreCase(caller) ? null : "configuration:manage";
        }
        return "configuration:manage";
    }

    /** GET /api/v1/users/{id}/roles or GET /api/v1/auth/evaluate: the lookups the other services' filters make. */
    static boolean isRoleLookup(String method, String path) {
        if (!method.equalsIgnoreCase("GET")) return false;
        return path.equals("/api/v1/auth/evaluate") || USER_ROLES_PATH.matcher(path).matches();
    }
}
