// ============================================================
//  FaceAttend EDU — useBiometricsViewModel
//
//  Estado compartido de la pantalla «Biometría»: persona seleccionada,
//  estado/mensajes y resumen biométrico (rostro/huella) de esa persona.
//  ms-biometric está indexado por person_id (UUID), no por username, así
//  que la identidad ya no es un texto libre: se elige con PersonAutocomplete
//  (ver BiometricsView). La captura de rostro y de huella viven en
//  useFaceCapture / useFingerprintReader (se montan solo cuando su
//  módulo está visible, para soltar cámara y lector al salir).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { biometricCaptureApi } from "../services/api/biometricCaptureApi";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";

export const BIOMETRIC_SECTIONS = ["face-register", "face-login", "fingerprint"];
export const DEFAULT_BIOMETRIC_SECTION = "face-register";

export function normalizeBiometricSection(section) {
    return BIOMETRIC_SECTIONS.includes(section) ? section : DEFAULT_BIOMETRIC_SECTION;
}

export function useBiometricsViewModel() {
    const { t } = useTranslation();

    // La persona a registrar/verificar se elige del directorio (PersonAutocomplete),
    // no se precarga con la sesión del operador: quien usa esta pantalla es un
    // admin/profesor registrando a OTRA persona (estudiante), no a sí mismo.
    const [person, setPersonState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatusState] = useState({
        text: t("Elige un módulo, selecciona una persona y sigue las instrucciones."),
        tone: "info",
    });
    const [health, setHealth] = useState("checking"); // checking | ok | down
    const [summary, setSummary] = useState(null); // { has_face, has_fingerprint } | null
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const setStatus = useCallback((text, tone = "info") => {
        if (mounted.current) setStatusState({ text, tone });
    }, []);

    const checkHealth = useCallback(async () => {
        try {
            const data = await biometricCaptureApi.health();
            if (mounted.current) setHealth(data?.status === "ok" ? "ok" : "down");
            return data?.status === "ok";
        } catch {
            if (mounted.current) setHealth("down");
            return false;
        }
    }, []);

    useEffect(() => {
        checkHealth();
    }, [checkHealth]);

    const refreshSummary = useCallback(async () => {
        if (!person?.personId) {
            setSummary(null);
            return null;
        }
        try {
            const data = await biometricCaptureApi.summary(person.personId);
            if (mounted.current) setSummary(data);
            return data;
        } catch (e) {
            if (mounted.current) setStatus(e.message, "error");
            return null;
        }
    }, [person, setStatus]);

    useEffect(() => {
        refreshSummary();
    }, [refreshSummary]);

    const setPerson = useCallback((selected) => {
        setPersonState(selected ?? null);
    }, []);

    /** Ejecuta una operación con bloqueo anti doble envío y reporte de errores unificado. */
    const run = useCallback(
        async (operation) => {
            if (busy) return;
            setBusy(true);
            try {
                await operation();
            } catch (e) {
                setStatus(e?.message || t("Error de solicitud"), "error");
            } finally {
                if (mounted.current) setBusy(false);
            }
        },
        [busy, setStatus, t]
    );

    const requirePersonId = useCallback(() => {
        if (!person?.personId) throw new Error(t("Selecciona una persona."));
        return person.personId;
    }, [person, t]);

    const checkPerson = useCallback(
        () =>
            run(async () => {
                requirePersonId();
                setStatus(t("Consultando persona..."));
                const data = await refreshSummary();
                setStatus(
                    `${t("rostro")}: ${data?.has_face ? t("sí") : t("no")}, ${t("huella")}: ${
                        data?.has_fingerprint ? t("sí") : t("no")
                    }`
                );
            }),
        [run, requirePersonId, setStatus, refreshSummary, t]
    );

    // Revocar biometría (canDeleteBiometrics, solo admin en UI).
    const revokeFace = useCallback(
        () =>
            run(async () => {
                const personId = requirePersonId();
                await biometricCaptureApi.revokeFace(personId);
                setStatus(t("Rostro revocado."), "ok");
                await refreshSummary();
            }),
        [run, requirePersonId, refreshSummary, setStatus, t]
    );

    const removeAll = useCallback(
        () =>
            run(async () => {
                const personId = requirePersonId();
                await biometricCaptureApi.deleteAllBiometrics(personId);
                setStatus(t("Biometría revocada."), "ok");
                await refreshSummary();
            }),
        [run, requirePersonId, refreshSummary, setStatus, t]
    );

    return {
        person,
        setPerson,
        requirePersonId,
        busy,
        run,
        status,
        setStatus,
        health,
        checkHealth,
        summary,
        refreshSummary,
        checkPerson,
        revokeFace,
        removeAll,
    };
}
