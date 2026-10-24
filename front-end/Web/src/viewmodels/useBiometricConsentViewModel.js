// ============================================================
//  FaceAttend EDU — useBiometricConsentViewModel
//  Estado de la autorización biométrica de la persona en sesión y su
//  revocación (Ley 1581, art. 8-e): identity registra la revocación y
//  biometric suprime las plantillas de rostro y huella.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { consentApi } from "../services/api/consentApi";

export function useBiometricConsentViewModel(personId) {
    const [authorized, setAuthorized] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [revoked, setRevoked] = useState(false);

    const load = useCallback(async () => {
        if (!personId) return;
        try {
            const consent = await consentApi.get(personId);
            setAuthorized(consent?.biometricAuthorized === true);
        } catch (e) {
            setError(e?.message || "No se pudo consultar la autorización");
        }
    }, [personId]);

    useEffect(() => {
        load();
    }, [load]);

    const revoke = useCallback(async () => {
        if (!personId || busy) return false;
        setBusy(true);
        setError(null);
        try {
            await consentApi.revokeBiometric(personId);
            setAuthorized(false);
            setRevoked(true);
            return true;
        } catch (e) {
            setError(e?.message || "No se pudo revocar la autorización");
            return false;
        } finally {
            setBusy(false);
        }
    }, [personId, busy]);

    return { authorized, busy, error, revoked, revoke, reload: load };
}
