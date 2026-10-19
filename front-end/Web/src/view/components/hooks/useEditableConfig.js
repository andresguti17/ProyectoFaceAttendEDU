// ============================================================
//  useEditableConfig — Hook genérico para estado editable
//
//  Abstracción reutilizable para manejar configuraciones editables
//  con detección automática de cambios, guardado y descarte.
//
//  CARACTERÍSTICAS:
//  - Agnóstico del contenido: funciona con cualquier objeto
//  - Detección automática de cambios mediante comparación profunda
//  - Inmutable: todas las actualizaciones crean nuevos objetos
//  - Soporte para guardado síncrono y asíncrono
//  - API limpia y composable
//
//  USO BÁSICO:
//  ```js
//  const { config, updateConfig, hasChanges, save, discard } = 
//    useEditableConfig(initialConfig, {
//      onSave: (config) => updateInstitutionConfig(config),
//      onHasChanges: (hasChanges) => parentCallback(hasChanges),
//    });
//  ```
//
//  INTEGRACIÓN CON PATRÓN EXISTENTE (refs + callbacks):
//  ```js
//  // En el componente hijo:
//  useEffect(() => {
//    if (onSave) onSave(save);
//  }, [onSave, save]);
//
//  useEffect(() => {
//    if (onDiscard) onDiscard(discard);
//  }, [onDiscard, discard]);
//  ```
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

/**
 * Comparación profunda de dos objetos
 * @param {*} obj1 
 * @param {*} obj2 
 * @returns {boolean}
 */
function deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== "object" || typeof obj2 !== "object") return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
}

/**
 * Hook genérico para manejar estado editable con snapshot
 * 
 * @param {Object} initialConfig - Configuración inicial
 * @param {Object} options - Opciones del hook
 * @param {Function} options.onSave - Callback de guardado: (config) => boolean | Promise<boolean>
 * @param {Function} options.onHasChanges - Callback cuando cambia hasChanges: (hasChanges) => void
 * @param {boolean} options.notifyOnMount - Si notificar hasChanges en el montaje (default: true)
 * @returns {Object} API del hook
 */
export function useEditableConfig(initialConfig, options = {}) {
    const {
        onSave,
        onHasChanges,
        notifyOnMount = true,
    } = options;

    // Estado editable actual
    const [config, setConfig] = useState(() => 
        initialConfig ? { ...initialConfig } : {}
    );
    
    // Snapshot original para detectar cambios
    const [snapshot, setSnapshot] = useState(() => 
        initialConfig ? { ...initialConfig } : {}
    );
    
    // Flag de carga inicial
    const [isInitialized, setIsInitialized] = useState(false);
    
    // Ref para evitar notificaciones redundantes
    const lastNotifiedChanges = useRef(null);

    // ── Inicialización ────────────────────────────────────────
    useEffect(() => {
        if (initialConfig && !isInitialized) {
            const initial = { ...initialConfig };
            setConfig(initial);
            setSnapshot(initial);
            setIsInitialized(true);
        }
    }, [initialConfig, isInitialized]);

    // ── Detectar cambios ──────────────────────────────────────
    const hasChanges = useMemo(() => {
        if (!isInitialized) return false;
        return !deepEqual(config, snapshot);
    }, [config, snapshot, isInitialized]);

    // ── Notificar cambios al padre ────────────────────────────
    useEffect(() => {
        if (!onHasChanges) return;
        
        // No notificar en el montaje inicial si notifyOnMount es false
        if (!notifyOnMount && !isInitialized) return;
        
        // Solo notificar si el valor cambió
        if (lastNotifiedChanges.current !== hasChanges) {
            onHasChanges(hasChanges);
            lastNotifiedChanges.current = hasChanges;
        }
    }, [hasChanges, onHasChanges, isInitialized, notifyOnMount]);

    // ── Actualizar un campo específico ────────────────────────
    const updateConfig = useCallback((key, value) => {
        setConfig(prev => ({
            ...prev,
            [key]: value,
        }));
    }, []);

    // ── Actualizar múltiples campos ───────────────────────────
    const updateMultiple = useCallback((updates) => {
        setConfig(prev => ({
            ...prev,
            ...updates,
        }));
    }, []);

    // ── Guardar configuración ─────────────────────────────────
    const save = useCallback(async () => {
        if (!onSave) {
            console.warn("useEditableConfig: onSave no está definido");
            return false;
        }

        try {
            const result = await onSave(config);
            
            // Si el guardado fue exitoso, actualizar el snapshot
            if (result) {
                setSnapshot({ ...config });
                return true;
            }
            
            return false;
        } catch (error) {
            console.error("useEditableConfig: Error al guardar:", error);
            return false;
        }
    }, [config, onSave]);

    // ── Descartar cambios ─────────────────────────────────────
    const discard = useCallback(() => {
        setConfig({ ...snapshot });
    }, [snapshot]);

    // ── Resetear con nueva configuración inicial ──────────────
    const reset = useCallback((newInitialConfig) => {
        const initial = { ...newInitialConfig };
        setConfig(initial);
        setSnapshot(initial);
    }, []);

    // ── API pública ───────────────────────────────────────────
    return {
        // Estado
        config,
        hasChanges,
        isInitialized,
        
        // Mutadores
        updateConfig,
        updateMultiple,
        setConfig,
        
        // Acciones
        save,
        discard,
        reset,
    };
}
