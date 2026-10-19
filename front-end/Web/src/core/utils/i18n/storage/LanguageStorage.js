// ============================================================
//  FaceAttend EDU — LanguageStorage (i18n · Storage)
//
//  Persiste el idioma seleccionado por el usuario.
//  Usa localStorage en web y AsyncStorage en mobile.
//  La UI nunca importa este archivo directamente.
// ============================================================

import { Platform } from "react-native";
import { DEFAULT_LANGUAGE }  from "../constants/SupportedLanguages";

const KEY = "faceattend_language";

// ── Abstracción de almacenamiento ─────────────────────────────────────────

async function storageGet(key) {
    if (Platform.OS === "web") {
        return localStorage.getItem(key);
    }
    // Lazy import para no romper web bundle
    const { default: AsyncStorage } = await import(
        "@react-native-async-storage/async-storage"
    );
    return AsyncStorage.getItem(key);
}

async function storageSet(key, value) {
    if (Platform.OS === "web") {
        localStorage.setItem(key, value);
        return;
    }
    const { default: AsyncStorage } = await import(
        "@react-native-async-storage/async-storage"
    );
    await AsyncStorage.setItem(key, value);
}

// ── API pública ───────────────────────────────────────────────────────────

export const LanguageStorage = {
    /**
     * Lee el idioma guardado. Devuelve el idioma por defecto si no hay ninguno.
     */
    async load() {
        try {
            const saved = await storageGet(KEY);
            return saved ?? DEFAULT_LANGUAGE;
        } catch {
            return DEFAULT_LANGUAGE;
        }
    },

    /**
     * Persiste el idioma seleccionado por el usuario.
     */
    async save(language) {
        try {
            await storageSet(KEY, language);
        } catch (e) {
            console.warn("[LanguageStorage] No se pudo guardar el idioma:", e);
        }
    },
};
