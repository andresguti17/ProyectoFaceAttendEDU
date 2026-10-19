package com.faceattend_edu.attendance_service.infrastructure.web.security;

import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.Set;

/**
 * Alcance por actor del request en curso (lo fija AuthTokenFilter). Sin atributo
 * (administrador, o pruebas sin filtro) no hay restricción.
 */
public final class ActorScope {

    public static final String ATTRIBUTE = "attendance.actorScope";

    private ActorScope() {}

    @SuppressWarnings("unchecked")
    private static Set<Long> current() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        Object scope = attributes == null ? null : attributes.getAttribute(ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        return scope instanceof Set<?> set ? (Set<Long>) set : null;
    }

    /** Actores visibles para quien llama, o {@code null} sin restricción. */
    public static Set<Long> actorIds() {
        return current();
    }

    public static boolean restricted() {
        return current() != null;
    }

    public static boolean allows(Long actorId) {
        Set<Long> scope = current();
        return scope == null || (actorId != null && scope.contains(actorId));
    }

    public static void require(Long actorId) {
        if (!allows(actorId)) throw new ScopeForbiddenException();
    }

    /** 403: el registro pertenece a un actor fuera del alcance de quien llama. */
    public static class ScopeForbiddenException extends RuntimeException {
        public ScopeForbiddenException() {
            super("Forbidden: outside your scope");
        }
    }
}
