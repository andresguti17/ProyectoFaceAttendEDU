// ============================================================
//  FaceAttend EDU — useAutoSlideOnContent Hook
// ============================================================
//  Hook reutilizable que detecta cambios en el contenido
//  visible y dispara automáticamente el autoslide cuando
//  aparece nuevo contenido (ej: recomendaciones, alertas, etc.)
//
//  Casos de uso:
//  ✓ Recomendaciones de contraseña que aparecen/desaparecen
//  ✓ Mensajes de error que se expanden
//  ✓ Listas dinámicas que crecen
//  ✓ Cualquier contenido que aparezca y necesite scroll automático
// ============================================================

import { useEffect, useRef } from 'react';

/**
 * Hook que detecta cuando aparece contenido nuevo y dispara autoslide
 * 
 * @param {number} visibleItemsCount - Cantidad de items visibles actualmente
 * @param {Function} autoSlideTrigger - Callback del autoslide del CustomScrollBar
 * @param {Object} options - Opciones de configuración
 * @param {number} options.delay - Delay antes de disparar el slide (ms)
 * @param {boolean} options.enabled - Si el hook está habilitado
 * @param {boolean} options.triggerOnIncrease - Solo disparar cuando aumenta el count
 * @param {boolean} options.triggerOnAnyChange - Disparar en cualquier cambio (default: false)
 * 
 * @example
 * // En tu componente:
 * const [autoSlideTrigger, setAutoSlideTrigger] = useState(null);
 * 
 * // Hook que detecta cambios
 * useAutoSlideOnContent(
 *   passwordRequirements.filter(r => !r.test).length, // Items visibles
 *   autoSlideTrigger,
 *   { triggerOnIncrease: true } // Solo cuando aparecen MÁS items
 * );
 * 
 * // En CustomScrollBar:
 * <CustomScrollBar
 *   effects={{
 *     autoSlide: {
 *       enabled: true,
 *       target: 'end',
 *       trigger: (callback) => setAutoSlideTrigger(() => callback),
 *     }
 *   }}
 * />
 */
export function useAutoSlideOnContent(
    visibleItemsCount, 
    autoSlideTrigger, 
    options = {}
) {
    const {
        delay = 100,
        enabled = true,
        triggerOnIncrease = true,
        triggerOnAnyChange = false,
    } = options;

    const prevCountRef = useRef(visibleItemsCount);
    const timeoutRef = useRef(null);

    useEffect(() => {
        // Si el hook está deshabilitado, no hacer nada
        if (!enabled) return;

        // Si no hay trigger configurado, esperar
        if (!autoSlideTrigger) return;

        const prevCount = prevCountRef.current;
        const currentCount = visibleItemsCount;

        // Determinar si debe dispararse el slide
        let shouldTrigger = false;
        
        if (triggerOnAnyChange) {
            // Disparar en cualquier cambio
            shouldTrigger = currentCount !== prevCount && currentCount > 0;
        } else if (triggerOnIncrease) {
            // Solo cuando aumenta
            shouldTrigger = currentCount > prevCount && currentCount > 0;
        } else {
            // Cualquier cambio (pero no si es 0)
            shouldTrigger = currentCount !== prevCount && currentCount > 0;
        }

        if (shouldTrigger) {
            // Limpiar timeout previo si existe
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Disparar el slide con delay
            timeoutRef.current = setTimeout(() => {
                if (autoSlideTrigger) {
                    autoSlideTrigger();
                }
            }, delay);
        }

        // Actualizar el contador previo SIEMPRE
        prevCountRef.current = currentCount;

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [visibleItemsCount, autoSlideTrigger, delay, enabled, triggerOnIncrease, triggerOnAnyChange]);
}

/**
 * Hook especializado para detectar cuando aparece contenido booleano
 * (útil para mostrar/ocultar secciones completas)
 * 
 * @param {boolean} isVisible - Si el contenido está visible
 * @param {Function} autoSlideTrigger - Callback del autoslide
 * @param {Object} options - Opciones de configuración
 * 
 * @example
 * useAutoSlideOnShow(
 *   showPasswordIndicator,
 *   autoSlideTrigger
 * );
 */
export function useAutoSlideOnShow(
    isVisible,
    autoSlideTrigger,
    options = {}
) {
    const {
        delay = 100,
        enabled = true,
    } = options;

    const prevVisibleRef = useRef(isVisible);
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (!enabled || !autoSlideTrigger) return;

        const wasHidden = !prevVisibleRef.current;
        const isNowVisible = isVisible;

        // Disparar solo cuando cambia de oculto a visible
        if (wasHidden && isNowVisible) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                if (autoSlideTrigger) {
                    autoSlideTrigger();
                }
            }, delay);
        }

        prevVisibleRef.current = isVisible;

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [isVisible, autoSlideTrigger, delay, enabled]);
}

export default useAutoSlideOnContent;
