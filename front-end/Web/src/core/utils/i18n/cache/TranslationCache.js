// ============================================================
//  FaceAttend EDU — TranslationCache (i18n · Cache)
//
//  Caché en memoria (Map) de dos niveles:
//    idioma → texto fuente (español) → traducción
//
//  Comportamiento:
//    - Español NO se cachea (es el idioma fuente)
//    - Solo cachea traducciones para idiomas != "es"
//    - O(1) lectura y escritura
//    - Sin dependencias externas
//    - Sobrevive a cambios de idioma dentro de la sesión
//    - Se hidrata desde TranslationStorage al iniciar
//    - Minimiza llamadas HTTP al microservicio de traducción
// ============================================================

export class TranslationCache {
    // Map
    store = new Map();

    // ── Lectura ──────────────────────────────────────────────

    /** Devuelve la traducción si existe en memoria, null si no. */
    get(language, source) {
        return this.store.get(language)?.get(source) ?? null;
    }

    /** True si la traducción ya está en memoria. */
    has(language, source) {
        return this.store.get(language)?.has(source) ?? false;
    }

    // ── Escritura ────────────────────────────────────────────

    /** Almacena una traducción en memoria. */
    set(language, source, translation) {
        if (!this.store.has(language)) {
            this.store.set(language, new Map());
        }
        this.store.get(language).set(source, translation);
    }

    // ── Hidratación desde storage ────────────────────────────

    /**
     * Carga un diccionario completo (texto → traducción) para un idioma.
     * Llamado al inicializar desde el almacenamiento persistente.
     * Si ya existen entradas para ese idioma, las combina (merge).
     */
    hydrate(language, entries) {
        if (!this.store.has(language)) {
            this.store.set(language, new Map());
        }
        const map = this.store.get(language);
        for (const [source, translation] of Object.entries(entries)) {
            map.set(source, translation);
        }
    }

    // ── Exportación para persistencia ────────────────────────

    /**
     * Exporta todas las traducciones de un idioma como Record plano.
     * Usado por TranslationStorage para persistir en disco.
     */
    export(language) {
        const map = this.store.get(language);
        if (!map) return {};
        return Object.fromEntries(map.entries());
    }

    /** Exporta todos los idiomas. */
    exportAll() {
        const result = {};
        for (const [lang, map] of this.store.entries()) {
            result[lang] = Object.fromEntries(map.entries());
        }
        return result;
    }

    // ── Utilidades ───────────────────────────────────────────

    /** Número de traducciones en caché para un idioma. */
    size(language) {
        return this.store.get(language)?.size ?? 0;
    }

    /** Elimina todas las entradas de un idioma (por ejemplo, al invalidar). */
    clear(language) {
        if (language) {
            this.store.delete(language);
        } else {
            this.store.clear();
        }
    }
}

// Singleton — toda la app comparte la misma instancia en memoria
export const translationCache = new TranslationCache();
