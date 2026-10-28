// ============================================================
//  FaceAttend EDU — useMinorEnrollmentViewModel
//  Registro de un aprendiz menor de edad por el administrador de la sede:
//   1. registrar / editar al acudiente y vincularlo al menor,
//   2. registrar la aceptación de los términos por el acudiente (presente en la sede),
//   3. (el modal sigue con el ingreso de parámetros faciales, que reutiliza la captura biométrica).
//  Las funciones devuelven null si salió bien o el mensaje de error, como el resto de los VM.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { termsApi, guardianApi } from "../services/api/termsApi";
import { consentApi } from "../services/api/consentApi";

export const GUARDIAN_DOCUMENT_TYPES = ["CC", "CE", "PP"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const EMPTY_FORM = {
    fullName: "",
    documentType: "CC",
    documentNumber: "",
    email: "",
    phone: "",
    relationship: "",
};

/** Mensaje de error de validación del acudiente, o null. */
export function validateGuardian(form) {
    if (!String(form.fullName ?? "").trim()) return "Escribe el nombre completo del acudiente";
    if (!GUARDIAN_DOCUMENT_TYPES.includes(form.documentType)) return "El documento del acudiente debe ser CC, CE o PP";
    if (!String(form.documentNumber ?? "").trim()) return "Escribe el número de documento del acudiente";
    if (!String(form.relationship ?? "").trim()) return "Indica el parentesco con el aprendiz";
    const email = String(form.email ?? "").trim();
    const phone = String(form.phone ?? "").trim();
    if (!email && !phone) return "Escribe un correo o un teléfono de contacto del acudiente";
    if (email && !EMAIL.test(email)) return "El correo del acudiente no es válido";
    return null;
}

export function useMinorEnrollmentViewModel(personId) {
    const [enablement, setEnablement] = useState(null);
    const [guardian, setGuardian] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(Boolean(personId));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const fetchState = useCallback(async () => {
        if (!personId) return;
        try {
            setEnablement(await termsApi.get(personId));
            let current = null;
            try {
                current = await guardianApi.get(personId);
            } catch (err) {
                // 404: todavía no hay acudiente; cualquier otro error sí se muestra.
                if (err?.status !== 404) throw err;
            }
            setGuardian(current);
            setForm(current
                ? {
                    fullName: current.fullName ?? "",
                    documentType: current.documentType ?? "CC",
                    documentNumber: current.documentNumber ?? "",
                    email: current.email ?? "",
                    phone: current.phone ?? "",
                    relationship: current.relationship ?? "",
                }
                : EMPTY_FORM);
        } catch (err) {
            setError(err?.message || "No se pudo consultar el estado del registro");
        } finally {
            setLoading(false);
        }
    }, [personId]);

    useEffect(() => {
        let alive = true;
        Promise.resolve().then(() => alive && fetchState());
        return () => {
            alive = false;
        };
    }, [fetchState]);

    const reload = useCallback(() => {
        setLoading(true);
        setError(null);
        return fetchState();
    }, [fetchState]);

    const setField = useCallback((key, value) => setForm((prev) => ({ ...prev, [key]: value })), []);

    /** Registra al acudiente (y lo vincula al menor) o edita el ya vinculado. */
    const saveGuardian = useCallback(async () => {
        const invalid = validateGuardian(form);
        if (invalid) return invalid;
        setSaving(true);
        try {
            const saved = guardian
                ? await guardianApi.update(personId, form)
                : await guardianApi.register(personId, form);
            setGuardian(saved);
            setEnablement(await termsApi.get(personId));
            return null;
        } catch (err) {
            return err?.message || "No se pudo guardar al acudiente";
        } finally {
            setSaving(false);
        }
    }, [form, guardian, personId]);

    /**
     * Registra que el acudiente, presente en la sede, aceptó los términos. Con la autorización
     * de datos (aviso de privacidad) a nombre del menor, y la biométrica solo si el acudiente la da.
     */
    const recordTerms = useCallback(async ({ biometricAccepted = false } = {}) => {
        if (!guardian) return "Registra primero al acudiente";
        setSaving(true);
        try {
            await termsApi.accept(personId);
            await consentApi.accept(personId, { biometricAccepted });
            setEnablement(await termsApi.get(personId));
            return null;
        } catch (err) {
            return err?.message || "No se pudo registrar la aceptación de los términos";
        } finally {
            setSaving(false);
        }
    }, [guardian, personId]);

    return {
        enablement,
        guardian,
        form,
        loading,
        saving,
        error,
        setField,
        saveGuardian,
        recordTerms,
        reload,
        guardianRegistered: enablement?.guardianRegistered === true,
        termsAccepted: enablement?.termsUpToDate === true,
        enabled: enablement?.enabled === true,
    };
}
