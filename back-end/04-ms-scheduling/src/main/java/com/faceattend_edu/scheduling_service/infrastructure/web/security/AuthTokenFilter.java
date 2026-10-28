package com.faceattend_edu.scheduling_service.infrastructure.web.security;

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

import com.faceattend_edu.scheduling_service.infrastructure.web.security.CallerSchoolResolver.CallerSchool;
import org.springframework.beans.factory.ObjectProvider;

/**
 * Exige Bearer con sessionId opaco de identity en todo /api/** (salud/docs públicos).
 * Valida la sesión contra identity, resuelve roles y evalúa el permiso requerido
 * contra authorization. Propaga X-User-Id / X-User-Roles.
 *
 * <p>Lecturas exigen attendance.record:read (lo tienen los 3 roles); escrituras de
 * ambientes y bloques exigen academic.school:manage (Administrador); las de sesiones
 * y open/close/cancel exigen scheduling.session:manage (Administrador, Instructor).</p>
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
    // Perezoso: los tests @WebMvcTest cargan el filtro sin la capa de persistencia.
    private final ObjectProvider<CallerSchoolResolver> schoolResolver;

    /** Atributo con el CallerSchool resuelto, para que los controladores lo lean (CallerSchoolContext). */
    public static final String CALLER_SCHOOL_ATTRIBUTE = "scheduling.callerSchool";

    public AuthTokenFilter(ObjectProvider<CallerSchoolResolver> schoolResolver,
                           @Value("${faceattend.auth.identity-url:http://localhost:8081}") String identityUrl,
                           @Value("${faceattend.auth.authorization-url:http://localhost:8082}") String authorizationUrl) {
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

        // Environments/bloques/sesiones trazan a una sede (directa o vía environment);
        // Administrador (sede propia) y Super Administrador (todas) se distinguen aquí,
        // nunca por lo que el cliente declare en query/body.
        CallerSchoolResolver resolver = schoolResolver.getIfAvailable();
        if (resolver != null) {
            CallerSchool callerSchool;
            try {
                callerSchool = resolver.resolve(caller, roles, rawToken);
            } catch (RuntimeException e) {
                log.warn("AuthTokenFilter: caller school for {} failed: {}", caller, e.getMessage());
                deny(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Cannot resolve caller school", path);
                return;
            }
            request.setAttribute(CALLER_SCHOOL_ATTRIBUTE, callerSchool);
        }

        SessionAuthClient.propagate(request, response, result.caller());
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    static String requiredPermission(String method, String path) {
        if (method.equalsIgnoreCase("GET")) return "attendance.record:read";
        // Ambientes y bloques horarios son infraestructura de la sede: solo Administrador.
        if (path.startsWith("/api/v1/environments") || path.startsWith("/api/v1/schedule-blocks")) {
            return "academic.school:manage";
        }
        return "scheduling.session:manage";
    }

    private boolean isPublic(String path) {
        if (SessionAuthClient.isPublicPrefix(path)) return true;
        return false;
    }
}
