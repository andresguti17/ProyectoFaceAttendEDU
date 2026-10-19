// ============================================================
//  FaceAttend EDU — TranslationService (i18n · Service)
//
//  Servicio centralizado de traducción con tracking automático.
//
//  FLUJO:
//    1. getCached(text, lang) → devuelve traducción del cache o texto original
//    2. Rastrea automáticamente qué textos se están usando
//    3. prepareCurrentTexts(lang) → traduce todos los textos rastreados
//    4. hydrate(lang) → carga traducciones del storage al cache
//
//  API:
//    translationService.getCached(text, lang) → string (sync)
//    translationService.prepareCurrentTexts(lang) → Promise<void>
//    translationService.hydrate(lang) → Promise<void>
// ============================================================

import { translationCache } from "../cache/TranslationCache";
import { TranslationStorage } from "../storage/TranslationStorage";
import { RestTranslationProvider } from "../providers/RestTranslationProvider";
import { SOURCE_LANGUAGE } from "../constants/SupportedLanguages";

const BATCH_SIZE = 20;

class TranslationService {
    provider = new RestTranslationProvider();
    hydratedLanguages = new Set();
    
    // Tracking automático de textos usados
    activeTexts = new Set();
    
    // Estado del servicio
    serviceAvailable = null; // null = no verificado, true = disponible, false = caído
    healthCheckInterval = null;
    healthCheckIntervalMs = 10000; // 10 segundos
    pendingTextsForRetry = null; // Textos que esperan reintento cuando el servicio vuelva

    // ── Health Check Asíncrono ────────────────────────────────────────────

    /**
     * Inicia polling de health check
     * Cuando el servicio vuelve a estar disponible, dispara callback
     */
    startHealthMonitoring(onServiceAvailable, textsToRetry = null) {
        // Si ya está monitoreando, no iniciar otro
        if (this.healthCheckInterval) return;

        // Guardar textos pendientes para reintentar
        if (textsToRetry) {
            this.pendingTextsForRetry = textsToRetry;
        }

        console.log(`[TranslationService] Iniciando monitoreo de salud del microservicio (cada ${this.healthCheckIntervalMs}ms)`);

        this.healthCheckInterval = setInterval(async () => {
            try {
                const health = await this.provider.checkHealth();
                if (health.status === "ok" && this.serviceAvailable === false) {
                    console.log(`[TranslationService] ✓ Microservicio recuperado`);
                    this.serviceAvailable = true;
                    this.stopHealthMonitoring();
                    
                    // Notificar que el servicio está disponible de nuevo
                    if (onServiceAvailable) {
                        onServiceAvailable(this.pendingTextsForRetry);
                    }
                    
                    // Limpiar textos pendientes
                    this.pendingTextsForRetry = null;
                }
            } catch (error) {
                // Silencioso - seguir esperando
            }
        }, this.healthCheckIntervalMs);
    }

    /**
     * Detiene polling de health check
     */
    stopHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log(`[TranslationService] Monitoreo de salud detenido`);
        }
    }

    // ── Consulta síncrona (para t()) ──────────────────────────────────────

    /**
     * Obtiene traducción del cache (SÍNCRONA)
     * Si no existe, devuelve el texto original
     * Rastrea automáticamente el texto como "activo"
     * 
     * @param {string} text - Texto en español
     * @param {string} language - Idioma destino
     * @returns {string} - Traducción si existe, o texto original
     */
    getCached(text, language) {
        if (language === SOURCE_LANGUAGE) return text;
        if (!text || !text.trim()) return text;

        // Rastrear texto como activo
        this.activeTexts.add(text);

        const cached = translationCache.get(language, text);
        return cached !== null ? cached : text;
    }

    // ── Limpiar textos rastreados ─────────────────────────────────────────

    /**
     * Limpia el tracking de textos activos
     */
    clearTracking() {
        console.log(`[TranslationService] Limpiando tracking: ${this.activeTexts.size} textos`);
        this.activeTexts.clear();
    }

    /**
     * Resetea el tracking al montar una nueva View
     * Permite que solo se rastreen textos de la View actual
     */
    resetTracking() {
        console.log(`[TranslationService] ⚡ Reseteando tracking (nueva View montada)`);
        this.clearTracking();
    }

    // ── Obtener textos activos ────────────────────────────────────────────

    /**
     * Obtiene todos los textos que se están usando actualmente
     */
    getActiveTexts() {
        return Array.from(this.activeTexts);
    }

    // ── Hidratación desde storage ─────────────────────────────────────────

    /**
     * Carga traducciones guardadas del storage al cache
     */
    async hydrate(language) {
        if (language === SOURCE_LANGUAGE) return;
        if (this.hydratedLanguages.has(language)) return;

        console.log(`[TranslationService] Hidratando: ${language}`);
        
        const entries = await TranslationStorage.load(language);
        if (Object.keys(entries).length > 0) {
            translationCache.hydrate(language, entries);
        }
        
        this.hydratedLanguages.add(language);
        
        console.log(`[TranslationService] Hidratado: ${Object.keys(entries).length} traducciones`);
    }

    // ── Preparación de textos actualmente en uso ──────────────────────────

    /**
     * Prepara traducciones para todos los textos rastreados (View actual)
     * 
     * @param {boolean} forceCheck - Forzar verificación de health (reintento manual)
     */
    async prepareCurrentTexts(language, forceCheck = true) {
        const texts = this.getActiveTexts();
        
        if (texts.length === 0) {
            console.log(`[TranslationService] No hay textos activos para traducir`);
            return;
        }

        console.log(`[TranslationService] Preparando textos de View actual: ${texts.length} textos`);
        
        // Preparar traducciones
        await this.prepareTranslations(texts, language, forceCheck);
        
        console.log(`[TranslationService] ✓ Preparación completada`);
    }

    // ── Preparación para cambio de idioma ─────────────────────────────────

    /**
     * Prepara traducciones para un conjunto de textos
     * Espera a que TODAS estén listas antes de resolver
     * Verifica el health del microservicio antes de proceder
     * 
     * @param {boolean} forceCheck - Forzar verificación de health (ej: reintento manual)
     */
    async prepareTranslations(texts, language, forceCheck = false) {
        if (language === SOURCE_LANGUAGE) return;
        if (!texts || texts.length === 0) return;

        // Hidratar si es necesario
        if (!this.hydratedLanguages.has(language)) {
            await this.hydrate(language);
        }

        // Filtrar textos faltantes
        const missing = texts.filter(text => {
            if (!text || !text.trim()) return false;
            return translationCache.get(language, text) === null;
        });

        if (missing.length === 0) {
            console.log(`[TranslationService] Todas las traducciones ya están en cache`);
            return;
        }

        // Si ya sabemos que el servicio no está disponible y NO es reintento manual, abortar
        if (this.serviceAvailable === false && !forceCheck) {
            console.log(`[TranslationService] Servicio no disponible, abortando (usar forceCheck para reintentar)`);
            return;
        }

        console.log(`[TranslationService] Faltan ${missing.length} traducciones, verificando microservicio...`);

        // ✓ VERIFICAR HEALTH DEL MICROSERVICIO ANTES DE PROCEDER
        try {
            const health = await this.provider.checkHealth();
            
            if (health.status !== "ok") {
                throw new Error(`Status no es "ok": ${health.status}`);
            }
            
            console.log(`[TranslationService] Microservicio disponible: ${health.status}`);
            this.serviceAvailable = true;
            
            // Si había monitoreo activo, detenerlo
            this.stopHealthMonitoring();
            
        } catch (error) {
            console.warn(`[TranslationService] Microservicio no disponible:`, error.message);
            this.serviceAvailable = false;
            return; // Abortar sin procesar
        }

        // Procesar en batches solo si el servicio está disponible
        console.log(`[TranslationService] Procesando ${missing.length} traducciones...`);
        
        for (let i = 0; i < missing.length; i += BATCH_SIZE) {
            const chunk = missing.slice(i, i + BATCH_SIZE);
            await Promise.all(chunk.map(text => this.fetchAndCache(text, language)));
        }

        // Persistir todas las traducciones
        await this.persist(language);
        
        console.log(`[TranslationService] ✓ Preparación completada: ${missing.length} traducciones guardadas`);
    }

    // ── Traducción individual ─────────────────────────────────────────────

    async fetchAndCache(text, language) {
        try {
            const result = await this.provider.translate(text, SOURCE_LANGUAGE, language);
            const translation = result?.translatedText || text;
            translationCache.set(language, text, translation);
            return translation;
        } catch (error) {
            console.error(`[TranslationService] Error traduciendo "${text}":`, error);
            throw error;
        }
    }

    // ── Persistencia ──────────────────────────────────────────────────────

    async persist(language) {
        try {
            const entries = translationCache.export(language);
            await TranslationStorage.save(language, entries);
        } catch (error) {
            console.warn(`[TranslationService] Error al persistir (${language}):`, error);
        }
    }

    // ── Limpieza ──────────────────────────────────────────────────────────

    async invalidate(language) {
        translationCache.clear(language);
        this.hydratedLanguages.delete(language);
        await TranslationStorage.clear(language);
    }

    async invalidateAll() {
        translationCache.clearAll();
        this.hydratedLanguages.clear();
        await TranslationStorage.clearAll();
    }

    // ── Cleanup ───────────────────────────────────────────────────────────

    cleanup() {
        this.stopHealthMonitoring();
    }
}

export const translationService = new TranslationService();
