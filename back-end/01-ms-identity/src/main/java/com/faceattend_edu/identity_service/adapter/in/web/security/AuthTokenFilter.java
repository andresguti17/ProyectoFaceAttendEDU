package com.faceattend_edu.identity_service.adapter.in.web.security;

import static com.faceattend_edu.shared.auth.SessionAuthClient.deny;
import com.faceattend_edu.shared.auth.SessionAuthClient;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
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
 * Exige Bearer con sessionId opaco en todo /api/** salvo login/logout/refresh y recuperación de contraseña (bootstrap).
 * Valida la sesión contra el propio store vía identity, resuelve roles y evalúa
 * el permiso requerido contra authorization. Propaga X-User-Id / X-User-Roles.
 *
 * <p>La validación de sesión vive en back-end/shared/auth-java (SessionAuthClient);
 * aquí quedan las reglas de permiso y alcance de este servicio.
 * Futuro ADR-007 (JWT RS256 emitido por identity): aceptar JWT firmado aquí
 * como alternativa al sessionId opaco.</p>
 */
@Component
public class AuthTokenFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthTokenFilter.class);

    /** Atributo que marca un PUT sobre la propia persona hecho sin identity.person:write. */
    public static final String SELF_EDIT_ATTRIBUTE = "identity.selfEdit";
    /** Idem, cuando quien edita su persona NO tiene identity.person:write: nombres y correo también quedan fijos. */
    public static final String SELF_EDIT_LIMITED_ATTRIBUTE = "identity.selfEditLimited";
    /** Set<UUID> de personas visibles para quien no es administrador (listado de /persons). */
    public static final String PERSON_SCOPE_ATTRIBUTE = "identity.personScope";

    private static final Pattern PERSON_ITEM = Pattern.compile("^/api/v1/persons/([0-9a-fA-F-]{36})$");
    private static final Pattern USER_ITEM = Pattern.compile("^/api/v1/users/([0-9a-fA-F-]{36})$");
    /** Persona y sus sub-recursos de escritura: PUT /persons/{id}, PATCH /persons/{id}/status. */
    private static final Pattern PERSON_SCOPED = Pattern.compile("^/api/v1/persons/([0-9a-fA-F-]{36})(?:/status|/consent(?:/biometric)?)?$");
    /** Data-processing authorization (Ley 1581): the holder or an administrator; the use case decides. */
    private static final Pattern PERSON_CONSENT = Pattern.compile("^/api/v1/persons/([0-9a-fA-F-]{36})/consent(?:/biometric)?$");
    /** Cuenta y sub-recursos de escritura: PUT /users/{id}, PATCH .../status, POST .../activate. */
    private static final Pattern USER_SCOPED = Pattern.compile("^/api/v1/users/([0-9a-fA-F-]{36})(?:/status|/activate)?$");
    private static final Pattern USER_SESSIONS = Pattern.compile("^/api/v1/sessions/user/([0-9a-fA-F-]{36})$");
    private static final String WRITE = "identity.person:write";

    private final SessionAuthClient sessionAuth;
    // Perezoso: los tests @WebMvcTest cargan el filtro sin la capa de persistencia.
    private final ObjectProvider<LoadUserPort> loadUserPort;
    private final ObjectProvider<CallerScopeResolver> scopeResolver;
    private final ObjectProvider<LoadPersonPort> loadPersonPort;

    public AuthTokenFilter(ObjectProvider<LoadUserPort> loadUserPort, ObjectProvider<CallerScopeResolver> scopeResolver,
                           ObjectProvider<LoadPersonPort> loadPersonPort,
                           @Value("${faceattend.auth.identity-url:http://localhost:8081}") String identityUrl,
                           @Value("${faceattend.auth.authorization-url:http://localhost:8082}") String authorizationUrl) {
        this.loadUserPort = loadUserPort;
        this.loadPersonPort = loadPersonPort;
        this.scopeResolver = scopeResolver;
        this.sessionAuth = new SessionAuthClient(identityUrl, authorizationUrl);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || isPublic(request.getMethod(), path)) {
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

        String required = requiredPermission(request.getMethod(), path, caller);
        // Cada rol edita sus propios datos personales (perfil) sin identity.person:write.
        if (WRITE.equals(required) && isOwnPerson(request.getMethod(), path, caller)) {
            required = "identity.person:read";
            request.setAttribute(SELF_EDIT_ATTRIBUTE, Boolean.TRUE);
            // Quien administra personas conserva su alcance; el resto solo toca contacto y salud.
            if (!sessionAuth.isAllowed(result.caller(), WRITE)) {
                request.setAttribute(SELF_EDIT_LIMITED_ATTRIBUTE, Boolean.TRUE);
            }
        }
        if (required != null && !sessionAuth.isAllowed(result.caller(), required)) {
            deny(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden: requires " + required, path);
            return;
        }

        // Una cuenta ajena exige alcance; la propia no — y el guard de academic
        // resuelve la persona del llamante justo con esa auto-llamada: sin esta
        // excepción la resolución de alcance (→ academic-actors → identity
        // users/{id}) se llama a sí misma hasta agotar timeouts (503).
        boolean read = request.getMethod().equalsIgnoreCase("GET");
        Matcher userItemPath = (read ? USER_ITEM : USER_SCOPED).matcher(path);
        boolean ownUserItem = userItemPath.matches() && userItemPath.group(1).equalsIgnoreCase(caller);
        boolean scoped = read
                ? (path.startsWith("/api/v1/persons") || path.equals("/api/v1/users")
                        || (userItemPath.matches() && !ownUserItem))
                // Las escrituras sobre una persona/cuenta concreta también quedan acotadas a la sede.
                : (PERSON_SCOPED.matcher(path).matches() || (userItemPath.matches() && !ownUserItem));
        if (scoped && !applyPersonScope(request, response, path, caller, roles, rawToken)) {
            return;
        }

        SessionAuthClient.propagate(request, response, result.caller());
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private boolean isPublic(String method, String path) {
        if (SessionAuthClient.isPublicPrefix(path)) return true;
        // Bootstrap: login/logout públicos; el resto de /api/** exige sesión.
        if (path.equals("/api/v1/auth/login") && method.equalsIgnoreCase("POST")) return true;
        if (path.equals("/api/v1/auth/logout") && method.equalsIgnoreCase("POST")) return true;
        // Second step of a login with two-factor: the password already passed and there is no session yet.
        if (path.equals("/api/v1/auth/login/verify") && method.equalsIgnoreCase("POST")) return true;
        // Rotación de sesión (refresh token): el sessionId viejo viaja en el cuerpo
        // y se cierra al emitir el nuevo, por eso no exige bearer previo.
        if (path.equals("/api/v1/auth/refresh") && method.equalsIgnoreCase("POST")) return true;
        // Alta pública de sede + administrador: nadie tiene sesión todavía.
        if (path.equals("/api/v1/onboarding/schools") && method.equalsIgnoreCase("POST")) return true;
        // Recuperación de contraseña: todavía no hay sesión; la autorización la da
        // el reto verificado que vive en el almacén de códigos.
        if (path.equals("/api/v1/auth/forgot-password") && method.equalsIgnoreCase("POST")) return true;
        if (path.equals("/api/v1/auth/verify-code") && method.equalsIgnoreCase("POST")) return true;
        if (path.equals("/api/v1/auth/reset-password") && method.equalsIgnoreCase("POST")) return true;
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
        // Perfil propio: la cuenta sale de la sesión y el caso de uso solo toca campos editables.
        if (method.equalsIgnoreCase("PUT") && path.equals("/api/v1/auth/me/profile")) return null;
        // Segundo factor propio: basta la sesión; los casos de uso piden la contraseña o el código.
        if (method.equalsIgnoreCase("POST") && path.startsWith("/api/v1/auth/two-factor/")) return null;
        // Consent: every role may act on its own; ManageConsentUseCase limits others to administrators.
        if (PERSON_CONSENT.matcher(path).matches()) return "identity.person:read";
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
        Matcher item = PERSON_SCOPED.matcher(path);
        if (item.matches() && !scope.allows(UUID.fromString(item.group(1)))
                && !createdByCaller(UUID.fromString(item.group(1)), caller)) {
            deny(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden: person outside your scope", path);
            return false;
        }
        Matcher userItem = USER_SCOPED.matcher(path);
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

    /**
     * A person has no school of its own (it hangs off academic_actor), so one an
     * Administrador just created stays theirs to complete until it is assigned.
     */
    private boolean createdByCaller(UUID personId, String caller) {
        LoadPersonPort port = loadPersonPort.getIfAvailable();
        Person person = port == null ? null : port.loadPerson(personId);
        return person != null && person.getCreatedBy() != null
                && person.getCreatedBy().toString().equalsIgnoreCase(caller);
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
}
