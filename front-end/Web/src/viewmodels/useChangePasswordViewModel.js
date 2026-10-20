import { useState } from "react";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../context/AuthContext";
import { checkPassword } from "../core/utils/validation";

// ── useChangePasswordViewModel ───────────────────────────────
// Cambio de contraseña de la sesión actual. Se usa en la pantalla de cambio
// obligatorio (cuenta creada con credenciales iniciales por correo).

export function useChangePasswordViewModel() {
    const { t } = useTranslation();
    const { user, changePassword } = useAuth();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPasswords, setShowPasswords] = useState(false);
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState("");
    const [loading, setLoading] = useState(false);

    // Errores por campo; vacío = formulario válido.
    function validate() {
        const found = {};
        if (!currentPassword) found.currentPassword = t("Ingresa tu contraseña actual");

        if (!newPassword) {
            found.newPassword = t("La nueva contraseña es requerida");
        } else if (newPassword === currentPassword) {
            found.newPassword = t("La nueva contraseña debe ser distinta a la actual");
        } else {
            const check = checkPassword(newPassword, { username: user?.username, email: user?.email });
            if (!check.isValid) found.newPassword = t(check.errors[0]);
        }

        if (!confirmPassword) found.confirmPassword = t("Confirma la nueva contraseña");
        else if (confirmPassword !== newPassword) found.confirmPassword = t("Las contraseñas no coinciden");
        return found;
    }

    function clearFieldError(field) {
        setSubmitError("");
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }

    function setCurrent(text) {
        setCurrentPassword(text);
        clearFieldError("currentPassword");
    }

    function setNew(text) {
        setNewPassword(text);
        clearFieldError("newPassword");
    }

    function setConfirm(text) {
        setConfirmPassword(text);
        clearFieldError("confirmPassword");
    }

    function togglePasswords() {
        setShowPasswords((v) => !v);
    }

    function reset() {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setErrors({});
        setSubmitError("");
    }

    async function submit() {
        if (loading) return false;
        const found = validate();
        setErrors(found);
        if (Object.keys(found).length > 0) return false;

        setLoading(true);
        setSubmitError("");
        const failure = await changePassword(currentPassword, newPassword);
        setLoading(false);
        if (failure) {
            // La contraseña actual incorrecta se muestra junto a su campo.
            if (/actual no es correcta/i.test(failure)) {
                setErrors({ currentPassword: failure });
            } else {
                setSubmitError(failure);
            }
            return false;
        }
        return true;
    }

    return {
        username: user?.username ?? "",
        currentPassword,
        newPassword,
        confirmPassword,
        showPasswords,
        errors,
        submitError,
        loading,
        setCurrent,
        setNew,
        setConfirm,
        togglePasswords,
        reset,
        submit,
    };
}
