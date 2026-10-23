import { useState } from "react";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { authApi } from "../services/api/authApi";
import { normalizePhone } from "../core/utils/validation";
import {
    EMPTY_FORM,
    validateSchoolStep,
    validateAdminStep,
    buildOnboardingPayload,
    mapOnboardingError,
    normalizeSchoolCode,
    normalizeUsername,
    onlyLettersAndSpaces,
} from "../core/utils/schoolSignup";

// Campos de cada paso: el registro de una sede son dos pasos (sede y administrador).
const STEP_FIELDS = {
    1: ["code", "name", "cityName", "address", "phone", "email"],
    2: [
        "documentType", "documentNumber", "adminName", "adminLastName",
        "adminEmail", "adminPhone", "username", "password", "confirmPassword", "privacyAccepted",
    ],
};

const NORMALIZERS = {
    code: normalizeSchoolCode,
    username: normalizeUsername,
    cityName: onlyLettersAndSpaces,
    adminName: onlyLettersAndSpaces,
    adminLastName: onlyLettersAndSpaces,
    phone: normalizePhone,
    adminPhone: normalizePhone,
    documentNumber: (v) => String(v ?? "").replace(/[^A-Za-z0-9]/g, ""),
};

const SHAKE_MS = 300;

// ── useSignupViewModel ───────────────────────────────────────
// Alta pública de una sede y de su administrador (POST /api/v1/onboarding/schools).
// Ambos quedan pendientes de activación: no hay sesión al terminar.

export function useSignupViewModel(onSuccess) {
    const { t } = useTranslation();

    const [values, setValues] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [shakeFields, setShakeFields] = useState({});
    const [step, setStep] = useState(1);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [done, setDone] = useState(null);

    function errorsFor(stepNumber, current) {
        return stepNumber === 1 ? validateSchoolStep(current, t) : validateAdminStep(current, t);
    }

    function stepOf(field) {
        return STEP_FIELDS[1].includes(field) ? 1 : 2;
    }

    // Revalida el paso del campo y conserva solo el error de ese campo (y la
    // confirmación cuando cambia la contraseña): no se muestran errores de campos intactos.
    function refreshFieldError(field, nextValues, nextTouched) {
        const stepErrors = errorsFor(stepOf(field), nextValues);
        const related = field === "password" ? [field, "confirmPassword"] : [field];
        setErrors((prev) => {
            const next = { ...prev };
            related.forEach((f) => {
                if (nextTouched[f] && stepErrors[f]) next[f] = stepErrors[f];
                else delete next[f];
            });
            return next;
        });
    }

    function setValue(field, text) {
        const normalize = NORMALIZERS[field];
        const next = { ...values, [field]: normalize ? normalize(text) : text };
        setValues(next);
        setSubmitError("");
        refreshFieldError(field, next, { ...touched, [field]: touched[field] ?? false });
    }

    function handleBlur(field) {
        const nextTouched = { ...touched, [field]: true };
        setTouched(nextTouched);
        refreshFieldError(field, values, nextTouched);
    }

    function togglePassword() {
        setShowPassword((v) => !v);
    }

    // Marca todos los campos del paso como tocados, muestra sus errores y sacude los inválidos.
    function validateStep(stepNumber) {
        const fields = STEP_FIELDS[stepNumber];
        const stepErrors = errorsFor(stepNumber, values);
        setTouched((prev) => {
            const next = { ...prev };
            fields.forEach((f) => { next[f] = true; });
            return next;
        });
        setErrors((prev) => {
            const next = { ...prev };
            fields.forEach((f) => {
                if (stepErrors[f]) next[f] = stepErrors[f];
                else delete next[f];
            });
            return next;
        });
        const invalid = fields.filter((f) => stepErrors[f]);
        if (invalid.length > 0) {
            const shake = {};
            invalid.forEach((f) => { shake[f] = true; });
            setShakeFields(shake);
            setTimeout(() => setShakeFields({}), SHAKE_MS);
        }
        return invalid.length === 0;
    }

    function goNext() {
        if (validateStep(1)) setStep(2);
    }

    function goBack() {
        setSubmitError("");
        setStep(1);
    }

    async function handleRegister() {
        if (loading) return;
        if (step === 1) {
            goNext();
            return;
        }
        // Revalida la sede por si se llegó al paso 2 con datos que luego cambiaron.
        if (!validateStep(1)) {
            setStep(1);
            return;
        }
        if (!validateStep(2)) return;

        setLoading(true);
        setSubmitError("");
        try {
            const result = await authApi.onboardSchool(buildOnboardingPayload(values));
            setDone(result ?? {});
            onSuccess?.({ email: values.adminEmail.trim(), username: values.username.trim() });
        } catch (error) {
            const mapped = mapOnboardingError(error, t);
            if (mapped.field) {
                setTouched((prev) => ({ ...prev, [mapped.field]: true }));
                setErrors((prev) => ({ ...prev, [mapped.field]: mapped.message }));
                setShakeFields({ [mapped.field]: true });
                setTimeout(() => setShakeFields({}), SHAKE_MS);
            } else {
                setSubmitError(mapped.message);
            }
            if (mapped.step) setStep(mapped.step);
        } finally {
            setLoading(false);
        }
    }

    // Éxito visual de un campo: tocado, con valor y sin error.
    function isValid(field) {
        return !!touched[field] && !errors[field] && String(values[field] ?? "").trim() !== "";
    }

    return {
        values,
        errors,
        shakeFields,
        step,
        totalSteps: 2,
        showPassword,
        loading,
        submitError,
        done,
        setValue,
        handleBlur,
        togglePassword,
        goNext,
        goBack,
        handleRegister,
        isValid,
    };
}
