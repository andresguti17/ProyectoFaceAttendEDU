import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/apiClient';
import { MAX_CODE_ATTEMPTS, LOCKOUT_DURATION_MS, VerificationErrorType } from '../services/constants/auths';
import { VerificationService, VerificationError } from '../services/verificationService';

export function useCodeVerification({ email, onSuccess }) {
    const { t } = useTranslation();
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [attempts, setAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState(0);

    const isLockedOut = lockoutUntil > Date.now();
    const lockoutRemaining = isLockedOut ? Math.ceil((lockoutUntil - Date.now()) / 1000) : 0;

    const isComplete = code.replace(/ /g, '').length === 6;
    const canSubmit = isComplete && !isLoading && !isLockedOut;

    const verifyCode = useCallback(async () => {
        if (!canSubmit) {
            console.log('[verifyCode] Bloqueado → canSubmit:', canSubmit, '| code:', JSON.stringify(code));
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            const trimmed = code.replace(/ /g, '').toUpperCase();
            await VerificationService.verifyRecoveryCode(email, trimmed);
            onSuccess(); // ← abre el modal de nueva contraseña
        } catch (err) {
            console.log('[verifyCode] Error capturado:', err?.type ?? err?.message);

            const newAttempts = attempts + 1;
            setAttempts(newAttempts);

            // identity responde 400/401 a un código incorrecto, vencido o ya usado;
            // antes caía en el error genérico y nunca contaba intentos.
            const invalidCode = (err instanceof VerificationError && err.type === VerificationErrorType.INVALID_CODE)
                || (err instanceof ApiError && (err.status === 400 || err.status === 401));
            if (invalidCode) {
                if (newAttempts >= MAX_CODE_ATTEMPTS) {
                    setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
                    setError({
                        type: VerificationErrorType.GENERIC,
                        message: t('verifyCode.errorLocked', { seconds: Math.ceil(LOCKOUT_DURATION_MS / 1000) }),
                    });
                } else {
                    setError({
                        type: VerificationErrorType.INVALID_CODE,
                        message: t('verifyCode.errorInvalid', { attempts: MAX_CODE_ATTEMPTS - newAttempts }),
                    });
                }
            } else if (err instanceof VerificationError) {
                setError({ type: err.type, message: err.message });
            } else {
                setError({ type: VerificationErrorType.GENERIC, message: err?.message || t('httpErrors.unknown') });
            }
        } finally {
            setIsLoading(false);
        }
    }, [code, email, attempts, canSubmit, onSuccess, t]);

    const resetAttempts = useCallback(() => {
        setAttempts(0);
        setLockoutUntil(0);
        setCode('');
        setError(null);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        code, setCode, isLoading, error, attempts,
        isLockedOut, lockoutRemaining, canSubmit,
        verifyCode, resetAttempts, clearError,
    };
}