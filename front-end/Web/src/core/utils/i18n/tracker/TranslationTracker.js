// ============================================================
//  FaceAttend EDU — TranslationTracker
//
//  Rastrea los textos utilizados durante el render de la View actual.
//  Permite identificar qué traducciones necesita cada View.
//
//  API:
//    tracker.reset() → limpia textos rastreados
//    tracker.track(source) → registra un texto
//    tracker.getTexts() → obtiene array de textos únicos
// ============================================================

class TranslationTracker {
    constructor() {
        this.texts = new Set();
    }

    /**
     * Limpia todos los textos rastreados
     */
    reset() {
        this.texts.clear();
    }

    /**
     * Registra un texto como utilizado
     * @param {string} source - Texto en español
     */
    track(source) {
        if (!source || typeof source !== 'string') return;
        this.texts.add(source);
    }

    /**
     * Obtiene todos los textos rastreados
     * @returns {string[]} Array de textos únicos
     */
    getTexts() {
        return Array.from(this.texts);
    }
}

// Instancia global única
export const translationTracker = new TranslationTracker();
