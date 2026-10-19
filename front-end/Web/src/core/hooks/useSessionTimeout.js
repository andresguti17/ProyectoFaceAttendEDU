// ============================================================
//  useSessionTimeout — Hook para gestión automática de timeout de sesión
// ============================================================
//
//  Este hook:
//  ✓ Monitorea la actividad del usuario (movimiento del mouse, teclas, toques)
//  ✓ Reinicia el contador cuando detecta actividad
//  ✓ Ejecuta logout automático cuando se cumple el tiempo configurado
//  ✓ Proporciona tiempo restante para mostrar advertencias
//  ✓ Se limpia automáticamente cuando se deshabilita (logout)
//
//  Uso:
//    const { timeRemaining, isWarning, resetTimer } = useSessionTimeout({
//        timeoutMinutes: 60,
//        onTimeout: logout,
//        warningMinutes: 5,
//        enabled: user !== null // IMPORTANTE: deshabilitar al hacer logout
//    });
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';

export function useSessionTimeout({
    timeoutMinutes = 60,
    onTimeout,
    warningMinutes = 5,
    enabled = true
}) {
    const [timeRemaining, setTimeRemaining] = useState(() => timeoutMinutes * 60);
    const [isWarning, setIsWarning] = useState(false);
    const [isExpired, setIsExpired] = useState(false);
    
    const intervalRef = useRef(null);
    const lastActivityRef = useRef(() => Date.now());
    const onTimeoutRef = useRef(onTimeout);
    
    // Mantener la referencia actualizada
    useEffect(() => {
        onTimeoutRef.current = onTimeout;
    }, [onTimeout]);

    // Función para limpiar el interval
    const clearTimerInterval = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Función para resetear el timer de inactividad
    const resetTimer = useCallback(() => {
        // Si está deshabilitado, limpiar timer y resetear estados
        if (!enabled) {
            clearTimerInterval();
            setTimeRemaining(timeoutMinutes * 60);
            setIsWarning(false);
            setIsExpired(false);
            return;
        }
        
        lastActivityRef.current = Date.now();
        setTimeRemaining(timeoutMinutes * 60);
        setIsWarning(false);
        setIsExpired(false);
    }, [enabled, timeoutMinutes, clearTimerInterval]);

    // Función para registrar actividad del usuario
    const handleActivity = useCallback(() => {
        if (!enabled) return; // Guardia adicional
        
        resetTimer();
        
        // ===== NUEVO: Emitir evento para cerrar push notifications de sesión =====
        if (Platform.OS === 'web') {
            window.dispatchEvent(new CustomEvent('userActivityDetected', {
                detail: { timestamp: Date.now() }
            }));
        }
    }, [resetTimer, enabled]); // Agregar enabled como dependencia

    // Configurar listeners de actividad
    useEffect(() => {
        if (!enabled) return;

        const events = Platform.OS === 'web' 
            ? ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
            : ['touchstart', 'touchmove'];

        // Reducir throttle a 500ms para mejor respuesta
        const throttledHandler = throttle(handleActivity, 500);

        events.forEach(event => {
            if (Platform.OS === 'web') {
                document.addEventListener(event, throttledHandler, true);
            }
        });

        return () => {
            events.forEach(event => {
                if (Platform.OS === 'web') {
                    document.removeEventListener(event, throttledHandler, true);
                }
            });
        };
    }, [handleActivity, enabled]);

    // Efecto de limpieza final cuando el hook se desmonta
    useEffect(() => {
        return () => {
            // Limpiar interval al desmontar el componente completamente
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    // Timer principal que actualiza el tiempo restante
    useEffect(() => {
        // Si está deshabilitado, limpiar cualquier timer existente
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            // Resetear estados cuando se deshabilita
            setTimeRemaining(timeoutMinutes * 60);
            setIsWarning(false);
            setIsExpired(false);
            return;
        }



        // Inicializar lastActivityRef si es necesario
        if (typeof lastActivityRef.current === 'function') {
            lastActivityRef.current = lastActivityRef.current();
        }

        // Limpiar interval anterior si existe
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            const now = Date.now();
            const elapsed = now - lastActivityRef.current;
            const timeoutMs = timeoutMinutes * 60 * 1000;
            const remaining = Math.max(0, timeoutMs - elapsed);
            const remainingSeconds = Math.ceil(remaining / 1000);

            setTimeRemaining(remainingSeconds);

            // Verificar si estamos en periodo de advertencia
            const warningThreshold = warningMinutes * 60;
            const isInWarning = remainingSeconds <= warningThreshold && remainingSeconds > 0;
            setIsWarning(isInWarning);

            // Verificar si la sesión ha expirado
            if (remainingSeconds <= 0) {
                setIsExpired(true);
                if (onTimeoutRef.current) {
                    onTimeoutRef.current();
                }
            }
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, warningMinutes, timeoutMinutes]);

    // Función para formatear el tiempo restante
    const formatTimeRemaining = useCallback(() => {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, [timeRemaining]);

    return {
        timeRemaining,
        timeRemainingFormatted: formatTimeRemaining(),
        isWarning,
        isExpired,
        resetTimer,
        handleActivity,
        clearTimer: clearTimerInterval // Exponer función para limpiar timer externamente
    };
}

// Función helper para throttling
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}