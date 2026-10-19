import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUEST_TIMEOUT_MS,  PasswordUpdateErrorType } from '../services/constants/auths';
import { PasswordService } from '../services/passwordService';
import {validatePasswordRequirements, areAllRequirementsMet} from '../utils/passwordValidator';

/**
 * Hook para manejar actualización de contraseña
 * @param {Object} options - Opciones del hook
 * @param {string} options.email - Email del usuario
 * @param {Function} options.onSuccess - Callback de éxito
 * @returns {Object} Estado y acciones de actualización
 */
export function usePasswordUpdate({ email, onSuccess }) {
    const { t } = useTranslation();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const requirements = validatePasswordRequirements(newPassword);
    const allRequirementsMet = areAllRequirementsMet(requirements);
    const passwordsMatch = newPassword === confirmPassword;

    const canSubmit = allRequirementsMet &&
        passwordsMatch &&
        newPassword &&
        confirmPassword &&
        !isLoading;

    /**
     * Actualiza la contraseña
     */
    const updatePassword = useCallback(async () => {
        if (!canSubmit) return;

        setError(null);
        setIsLoading(true);

        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), REQUEST_TIMEOUT_MS)
            );

            await Promise.race([
                PasswordService.updatePassword(email, newPassword),
                timeoutPromise,
            ]);

            onSuccess();
        } catch (err) {
            if (err.message === 'timeout') {
                setError({
                    type: PasswordUpdateErrorType.TIMEOUT,
                    message: t('httpErrors.timeout'),
                });
            } else {
                setError({
                    type: PasswordUpdateErrorType.GENERIC,
                    message: err.message || t('profile.passwordModal.errorGeneric'),
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [email, newPassword, canSubmit, onSuccess, t]);

    /**
     * Resetea el formulario
     */
    const resetForm = useCallback(() => {
        setNewPassword('');
        setConfirmPassword('');
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setError(null);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        newPassword,
        setNewPassword,
        confirmPassword,
        setConfirmPassword,
        showNewPassword,
        setShowNewPassword,
        showConfirmPassword,
        setShowConfirmPassword,
        isLoading,
        error,
        requirements,
        allRequirementsMet,
        passwordsMatch,
        canSubmit,
        updatePassword,
        resetForm,
        clearError,
    };
}