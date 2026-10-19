import {useCallback, useState} from 'react';

/**
 * Hook universal para gestionar alertas/notificaciones.
 * Consolida la lógica repetida de estado de alerta en múltiples pantallas.
 * 
 * @returns {object} { alertData, setAlertData, showError, showSuccess, showWarning, clearAlert }
 */
export const useAlertState = () => {
    const [alertData, setAlertData] = useState({
        message: null,
        type: 'warning', // 'warning', 'success', 'error'
        timestamp: 0,
    });

    const clearAlert = useCallback(() => {
        setAlertData({
            message: null,
            type: 'warning',
            timestamp: 0,
        });
    }, []);

    const showError = useCallback((message, title = null, callback = null) => {
        setAlertData({
            message: message,
            type: 'error',
            title: title,
            timestamp: Date.now(),
            callback,
        });
    }, []);

    const showSuccess = useCallback((message, title = null, callback = null) => {
        setAlertData({
            message: message,
            type: 'success',
            title: title,
            timestamp: Date.now(),
            callback,
        });
    }, []);

    const showWarning = useCallback((message, title = null, callback = null) => {
        setAlertData({
            message: message,
            type: 'warning',
            title: title,
            timestamp: Date.now(),
            callback,
        });
    }, []);

    return {
        alertData,
        setAlertData,
        showError,
        showSuccess,
        showWarning,
        clearAlert,
    };
};
