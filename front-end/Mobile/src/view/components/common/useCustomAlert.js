import {useCallback, useState} from "react";
import i18n from "../../../utils/i18n";

export const useCustomAlert = () => {
    const isAlertEnabled = (type) => {
        const enabledTypes = ['default', 'warning', 'error', 'confirm', 'success']; // ← agrega 'success'
        return enabledTypes.includes(type);
    };
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: "",
        message: "",
        buttons: [],
        type: "default",
    });

    const showAlert = useCallback(({title, message, buttons, type = "default"}) => {
        // Verificar si este tipo de alerta está habilitado
        if (!isAlertEnabled(type)) {
            return;
        }
        setAlertConfig({
            visible: true,
            title,
            message,
            buttons,
            type,
        });
    }, [isAlertEnabled]);

    const hideAlert = useCallback(() => {
        setAlertConfig(prev => ({...prev, visible: false}));
    }, []);

    // Funciones de conveniencia para alertas comunes
    const showSuccess = useCallback((title, message, onPress) => {
        showAlert({
            title,
            message,
            type: "success",
            buttons: [{
                text: "OK", onPress: () => {
                    hideAlert();
                    onPress && onPress();
                }
            }],
        });
    }, [showAlert, hideAlert]);

    const showError = useCallback((title, message, onPress) => {
        showAlert({
            title,
            message,
            type: "error",
            buttons: [{
                text: "OK", onPress: () => {
                    hideAlert();
                    onPress && onPress();
                }
            }],
        });
    }, [showAlert, hideAlert]);

    const showWarning = useCallback((title, message, buttons) => {
        showAlert({
            title,
            message,
            type: "warning",
            buttons: buttons || [{text: "OK", onPress: hideAlert}],
        });
    }, [showAlert, hideAlert]);

    const showConfirm = useCallback((title, message, onConfirm, onCancel) => {
        showAlert({
            title,
            message,
            type: "confirm",
            buttons: [
                {
                    text: i18n.t("common.cancel"),
                    style: "cancel",
                    onPress: () => {
                        hideAlert();
                        onCancel && onCancel();
                    },
                },
                {
                    text: i18n.t("common.confirm"),
                    onPress: () => {
                        hideAlert();
                        onConfirm && onConfirm();
                    },
                },
            ],
        });
    }, [showAlert, hideAlert]);

    return {
        alertConfig,
        showAlert,
        hideAlert,
        showSuccess,
        showError,
        showWarning,
        showConfirm,
    };
};