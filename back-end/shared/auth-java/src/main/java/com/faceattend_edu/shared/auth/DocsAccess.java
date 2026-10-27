package com.faceattend_edu.shared.auth;

import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

import java.util.List;

/**
 * Qué rutas de la documentación de la API (springdoc) abre la cadena de seguridad.
 *
 * <p>Solo se abren sin sesión mientras springdoc está activado (desarrollo; producción lo apaga con
 * {@code SPRINGDOC_API_DOCS_ENABLED=false}). Apagado no se abre ninguna: la ruta recibe el mismo 403
 * que cualquier ruta desconocida, en lugar de llegar a un manejador que respondería 500 por un recurso
 * que no existe.</p>
 */
public final class DocsAccess {

    private static final List<String> DOC_PATHS = List.of("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html");

    private DocsAccess() {}

    public static RequestMatcher matcher(boolean docsEnabled) {
        if (!docsEnabled) return request -> false;
        PathPatternRequestMatcher.Builder paths = PathPatternRequestMatcher.withDefaults();
        return new OrRequestMatcher(DOC_PATHS.stream().map(paths::matcher).toArray(RequestMatcher[]::new));
    }
}
