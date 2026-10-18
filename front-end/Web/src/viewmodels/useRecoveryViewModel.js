// ============================================================
//  FaceAttend EDU — Recovery ViewModel
//
//  Flujo de recuperación con los endpoints públicos de identity:
//  forgot-password -> verify-code -> reset-password.
//  Sin sesión: la autorización la da el reto verificado.
// ============================================================

import { useState, useCallback } from "react";
import { authApi } from "../services/api/authApi";

export const RECOVERY_STEPS = {
    EMAIL: "email",
    CODE: "code",
    PASSWORD: "password",
    DONE: "done",
};

function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export function useRecoveryViewModel() {
    const [step, setStep] = useState(RECOVERY_STEPS.EMAIL);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);

    const sendCode = useCallback(async () => {
        const normalized = String(email).trim().toLowerCase();
        if (!isEmail(normalized)) {
            setError("Ingresa un correo válido");
            return false;
        }
        setError(null);
        setSending(true);
        try {
            await authApi.forgotPassword(normalized);
            setStep(RECOVERY_STEPS.CODE);
            return true;
        } catch (e) {
            setError(e?.message || "No se pudo enviar el código");
            return false;
        } finally {
            setSending(false);
        }
    }, [email]);

    const verifyCode = useCallback(async () => {
        const normalized = String(email).trim().toLowerCase();
        const trimmed = String(code).trim();
        if (trimmed.length < 4) {
            setError("Ingresa el código recibido");
            return false;
        }
        setError(null);
        setSending(true);
        try {
            await authApi.verifyCode(normalized, trimmed);
            setStep(RECOVERY_STEPS.PASSWORD);
            return true;
        } catch (e) {
            setError(e?.message || "Código inválido");
            return false;
        } finally {
            setSending(false);
        }
    }, [email, code]);

    const resetPassword = useCallback(async () => {
        if (String(password).length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres");
            return false;
        }
        if (password !== confirm) {
            setError("Las contraseñas no coinciden");
            return false;
        }
        setError(null);
        setSending(true);
        try {
            await authApi.resetPassword(String(email).trim().toLowerCase(), password);
            setStep(RECOVERY_STEPS.DONE);
            return true;
        } catch (e) {
            setError(e?.message || "No se pudo actualizar la contraseña");
            return false;
        } finally {
            setSending(false);
        }
    }, [email, password, confirm]);

    const goToStep = useCallback((next) => {
        setError(null);
        setStep(next);
    }, []);

    return {
        step,
        email,
        setEmail,
        code,
        setCode,
        password,
        setPassword,
        confirm,
        setConfirm,
        error,
        sending,
        sendCode,
        verifyCode,
        resetPassword,
        goToStep,
    };
}
