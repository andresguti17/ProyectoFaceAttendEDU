// ============================================================
//  FaceAttend EDU — NavigationPreparationManager
//
//  Controla el flujo de navegación con preparación de traducciones.
//
//  FLUJO:
//    1. Usuario navega a View B
//    2. Manager intercepta
//    3. Activa PREPARING
//    4. Reset tracker
//    5. Renderiza View B invisible
//    6. Recopila textos
//    7. Prepara traducciones
//    8. Espera a que terminen
//    9. Hace View B visible
//
//  API:
//    manager.setTargetRoute(route) → inicia preparación
//    manager.getCurrentRoute() → route actualmente visible
//    manager.isPreparing() → boolean
// ============================================================

import { translationService } from "../services/TranslationService";
import { translationTracker } from "../tracker/TranslationTracker";

class NavigationPreparationManager {
    constructor() {
        this.currentVisibleRoute = null;
        this.targetRoute = null;
        this.isPreparing = false;
        this.preparationId = 0;
        this.listeners = new Set();
        this.currentLanguage = 'es';
    }

    /**
     * Registra listener para cambios de estado
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notifica cambios a listeners
     */
    notifyListeners() {
        this.listeners.forEach(callback => callback());
    }

    /**
     * Establece el idioma actual
     */
    setLanguage(language) {
        this.currentLanguage = language;
    }

    /**
     * Obtiene la ruta actualmente visible
     */
    getCurrentRoute() {
        return this.currentVisibleRoute;
    }

    /**
     * Obtiene la ruta objetivo (durante preparación)
     */
    getTargetRoute() {
        return this.targetRoute;
    }

    /**
     * Indica si está en modo preparación
     */
    isPreparingTranslations() {
        return this.isPreparing;
    }

    /**
     * Establece la ruta inicial (sin preparación)
     */
    setInitialRoute(route) {
        this.currentVisibleRoute = route;
        this.targetRoute = route;
        console.log(`[NavManager] Ruta inicial: ${route}`);
    }

    /**
     * Navega a una nueva ruta con preparación de traducciones
     */
    async navigateToRoute(route) {
        if (route === this.currentVisibleRoute && !this.isPreparing) {
            console.log(`[NavManager] Ya estamos en ${route}`);
            return;
        }

        console.log(`[NavManager] ═══════════════════════════════════════`);
        console.log(`[NavManager] Navegación: ${this.currentVisibleRoute} → ${route}`);

        const preparationId = ++this.preparationId;

        // PASO 1: Activar PREPARING
        this.targetRoute = route;
        this.isPreparing = true;
        this.notifyListeners();

        try {
            // PASO 2: Reset tracker
            translationTracker.reset();
            console.log(`[NavManager] Tracker reseteado`);

            // PASO 3: Esperar render oculto de la View destino
            console.log(`[NavManager] Esperando render de ${route}...`);
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verificar si fue cancelado
            if (preparationId !== this.preparationId) {
                console.log(`[NavManager] Preparación cancelada`);
                return;
            }

            // PASO 4: Obtener textos recopilados
            const texts = translationTracker.getTexts();
            console.log(`[NavManager] Textos recopilados: ${texts.length}`);

            // PASO 5: Preparar traducciones
            if (texts.length > 0) {
                await translationService.prepareViewTranslations(texts, this.currentLanguage);
            }

            // Verificar nuevamente
            if (preparationId !== this.preparationId) {
                console.log(`[NavManager] Preparación cancelada después de traducir`);
                return;
            }

            // PASO 6: Hacer visible la View destino
            console.log(`[NavManager] ✓ Preparación completada, mostrando ${route}`);
            this.currentVisibleRoute = route;
            this.isPreparing = false;
            this.notifyListeners();

        } catch (error) {
            console.error('[NavManager] Error en preparación:', error);
            
            // Mostrar View aunque falle
            if (preparationId === this.preparationId) {
                this.currentVisibleRoute = route;
                this.isPreparing = false;
                this.notifyListeners();
            }
        }

        console.log(`[NavManager] ═══════════════════════════════════════`);
    }

    /**
     * Cancela cualquier preparación en curso
     */
    cancel() {
        this.preparationId++;
        this.isPreparing = false;
        this.targetRoute = this.currentVisibleRoute;
        this.notifyListeners();
    }
}

export const navigationPreparationManager = new NavigationPreparationManager();
