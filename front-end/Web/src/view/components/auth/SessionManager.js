// ============================================================
//  SessionManager — Sistema de advertencias de sesión con Push SIMPLE
// ============================================================

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { usePushNotification } from '../common/feedback/PushNotification';

export default function SessionManager() {
    const { sessionTimeout, logout } = useAuth();
    const pushNotification = usePushNotification();
    
    // Referencias estables
    const pushRef = useRef(pushNotification);
    const sessionRef = useRef(sessionTimeout);
    const sessionNotificationActive = useRef(false); // Prevenir múltiples notificaciones
    
    // Actualizar referencias
    pushRef.current = pushNotification;
    sessionRef.current = sessionTimeout;

    // Registrar listener UNA SOLA VEZ
    useEffect(() => {
        const handleUserActivity = () => {
            // Usar referencias para evitar dependencias
            const dismissed = pushRef.current.dismissBySource('session-warning', 'activity');
            
            if (dismissed) {
                sessionNotificationActive.current = false; // Permitir crear nueva notificación
                if (sessionRef.current?.resetTimer) {
                    sessionRef.current.resetTimer();
                }
            }
        };

        window.addEventListener('userActivityDetected', handleUserActivity);
        return () => window.removeEventListener('userActivityDetected', handleUserActivity);
    }, []); // Sin dependencias

    // Manejar warning state
    useEffect(() => {
        if (!sessionTimeout) return;

        const isWarning = sessionTimeout.isWarning;

        // Si entró en warning Y no hay notificación activa
        if (isWarning && !sessionNotificationActive.current) {
            const timeRemainingMs = sessionTimeout.timeRemaining * 1000;
            
            sessionNotificationActive.current = true; // Marcar como activa
            
            const notificationId = pushNotification.show({
                title: "Sesión por expirar",
                message: "Tu sesión se cerrará automáticamente por inactividad. ¿Deseas continuar?",
                type: "warning",
                source: "session-warning",
                duration: timeRemainingMs,
                
                // ===== LÍMITES ÚNICOS ESTRICTOS =====
                maxNotifications: 1,        // Solo 1 notificación en pantalla
                maxNotificationsByType: 1,  // Solo 1 de tipo warning  
                maxNotificationsBySource: 1, // Solo 1 de source session-warning
                allowDuplicates: false,     // No duplicados
                
                data: {
                    showTimer: true,
                    initialTimeSeconds: sessionTimeout.timeRemaining
                },
                onDismiss: (reason) => {
                    sessionNotificationActive.current = false; // Permitir crear nueva
                    if (reason === 'timeout') {
                        logout();
                    }
                }
            });
            
            // Si no se pudo crear (retornó null), resetear el flag
            if (!notificationId) {
                sessionNotificationActive.current = false;
            }
        }
        
    }, [sessionTimeout?.isWarning, pushNotification, logout]); // Remover timeRemaining de dependencias

    return null;
}