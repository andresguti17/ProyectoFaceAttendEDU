// ============================================================
//  FaceAttend EDU — Storage Utilities
//
//  Utilidades para manejo de storage multiplataforma
//  Usa localStorage en web y AsyncStorage en mobile
// ============================================================

import { Platform } from "react-native";

/**
 * Guardar datos en storage (síncrono en web, asíncrono en mobile)
 * @param {string} key - Clave de almacenamiento
 * @param {any} value - Valor a guardar (se serializa automáticamente)
 * @returns {boolean} True si se guardó correctamente
 */
export function saveToLocalStorage(key, value) {
    try {
        const serialized = JSON.stringify(value);
        
        if (Platform.OS === "web") {
            localStorage.setItem(key, serialized);
            return true;
        }
        
        // En mobile, esto sería asíncrono pero lo hacemos síncrono para compatibilidad
        // Nota: Idealmente toda la API debería ser async, pero por ahora mantenemos sync
        import("@react-native-async-storage/async-storage").then(({ default: AsyncStorage }) => {
            AsyncStorage.setItem(key, serialized);
        });
        return true;
    } catch (error) {
        console.error(`Error saving to storage [${key}]:`, error);
        return false;
    }
}

/**
 * Obtener datos de storage (síncrono en web)
 * @param {string} key - Clave de almacenamiento
 * @param {any} defaultValue - Valor por defecto si no existe
 * @returns {any} Valor deserializado o defaultValue
 */
export function getFromLocalStorage(key, defaultValue = null) {
    try {
        if (Platform.OS === "web") {
            const serialized = localStorage.getItem(key);
            if (serialized === null) return defaultValue;
            return JSON.parse(serialized);
        }
        
        // En mobile, no podemos hacer sync, devolver default
        // Nota: Para mobile necesitaríamos una API async completa
        console.warn(`[storage] getFromLocalStorage called in mobile, returning default value`);
        return defaultValue;
    } catch (error) {
        console.error(`Error reading from storage [${key}]:`, error);
        return defaultValue;
    }
}

/**
 * Eliminar un item de storage
 * @param {string} key - Clave a eliminar
 * @returns {boolean} True si se eliminó correctamente
 */
export function removeFromLocalStorage(key) {
    try {
        if (Platform.OS === "web") {
            localStorage.removeItem(key);
            return true;
        }
        
        import("@react-native-async-storage/async-storage").then(({ default: AsyncStorage }) => {
            AsyncStorage.removeItem(key);
        });
        return true;
    } catch (error) {
        console.error(`Error removing from storage [${key}]:`, error);
        return false;
    }
}

/**
 * Limpiar todo el storage
 * @returns {boolean} True si se limpió correctamente
 */
export function clearLocalStorage() {
    try {
        if (Platform.OS === "web") {
            localStorage.clear();
            return true;
        }
        
        import("@react-native-async-storage/async-storage").then(({ default: AsyncStorage }) => {
            AsyncStorage.clear();
        });
        return true;
    } catch (error) {
        console.error('Error clearing storage:', error);
        return false;
    }
}

/**
 * Verificar si existe una clave en storage (solo web sync)
 * @param {string} key - Clave a verificar
 * @returns {boolean} True si existe
 */
export function existsInLocalStorage(key) {
    if (Platform.OS === "web") {
        return localStorage.getItem(key) !== null;
    }
    return false; // En mobile no podemos verificar sync
}
