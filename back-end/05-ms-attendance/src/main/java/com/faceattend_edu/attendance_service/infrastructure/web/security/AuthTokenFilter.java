package com.faceattend_edu.attendance_service.infrastructure.web.security;

import static com.faceattend_edu.shared.auth.SessionAuthClient.deny;
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
import java.util.Set;

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
 * <p>La validación de sesión vive en back-end/shared/auth-java (SessionAuthClient);
 * aquí quedan las reglas de permiso y alcance de este servicio.
 * Futuro ADR-007 (JWT RS256 emitido por identity): aceptar JWT firmado aquí
 * como alternativa al sessionId opaco.</p>
 */
@Component
public class AuthTokenFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthTokenFilter.class);

    private final SessionAuthClient sessionAuth;
    private final ObjectProvider<CallerScopeResolver> scopeResolver;
    private final ObjectProvider<CallerSchoolResolver> schoolResolver;

    public AuthTokenFilter(ObjectProvider<CallerScopeResolver> scopeResolver, ObjectProvider<CallerSchoolResolver> schoolResolver,
                           @Value("${faceattend.auth.identity-url:http://localhost:8081}") String identityUrl,
                           @Value("${faceattend.auth.authorization-url:http://localhost:8082}") String authorizationUrl) {
        this.scopeResolver = scopeResolver;
        this.schoolResolver = schoolResolver;
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

        SessionAuthClient.AuthResult result = sessionAuth.authenticate(request.getHeader("Authorization"));
        if (!result.authenticated()) {
            deny(response, HttpServletResponse.SC_UNAUTHORIZED, result.denial(), path);
            return;
        }
        final String caller = result.caller().userId();
        final List<String> roles = result.caller().roles();
        final String rawToken = result.caller().token();

        String required = requiredPermission(request.getMethod(), path);
        if (required != null && !sessionAuth.isAllowed(result.caller(), required)) {
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

        request.setAttribute(CallerToken.ATTRIBUTE, rawToken);
        SessionAuthClient.propagate(request, response, result.caller());
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
                && (path.equals("/api/v1/justifications") || path.equals("/api/v1/supporting-documents")
                    || path.matches("/api/v1/justifications/[^/]+/documents"))) {
            return "attendance.justification:request";
        }
        return "attendance.record:write";
    }

    private boolean isPublic(String path) {
        if (SessionAuthClient.isPublicPrefix(path)) return true;
        return false;
    }
}
