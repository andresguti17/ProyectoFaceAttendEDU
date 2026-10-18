// ============================================================
//  FaceAttend EDU — useFingerprintReader
//
//  Lector DigitalPersona 4500 vía WebSdk. Lógica portada de face-auth:
//   - el SDK web habla con el RUNTIME DigitalPersona instalado en el equipo
//     donde está el lector (no corre en Docker ni en el servidor);
//   - el navegador captura la muestra (PNG) en memoria y la envía al API;
//     nunca se guarda en almacenamiento del navegador;
//   - sondeo cada 3 s para detectar el lector aunque se conecte después.
//  Los scripts del SDK se sirven desde /vendor (scripts/copy-digitalpersona.mjs).
//  Solo web.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { biometricCaptureApi } from "../services/api/biometricCaptureApi";
import { personMap, fullName } from "../services/api/referenceData";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";

// ms-biometric exige finger_number (1..10); el lector no lo reporta, así que
// se usa un valor fijo por defecto para esta pantalla. Si en el futuro se
// necesita capturar varios dedos por persona, este sería el punto a extender
// con un selector de dedo en la UI.
const DEFAULT_FINGER_NUMBER = 1;

const POLL_INTERVAL_MS = 3000;
const SDK_SCRIPTS = ["/vendor/websdk.client.ui.js", "/vendor/fingerprint.sdk.js"];

let sdkPromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-dp-sdk="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === "1") resolve();
            else {
                existing.addEventListener("load", () => resolve());
                existing.addEventListener("error", () => reject(new Error(src)));
            }
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.dataset.dpSdk = src;
        script.onload = () => {
            script.dataset.loaded = "1";
            resolve();
        };
        script.onerror = () => {
            script.remove();
            reject(new Error(`No se pudo cargar ${src}`));
        };
        document.head.appendChild(script);
    });
}

/** Carga (una sola vez) WebSdk y Fingerprint en window. En fallo permite reintentar. */
export function loadDigitalPersonaSdk() {
    if (Platform.OS !== "web") return Promise.reject(new Error("Solo disponible en web"));
    if (window.WebSdk && window.Fingerprint) return Promise.resolve();
    if (!sdkPromise) {
        sdkPromise = SDK_SCRIPTS.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve()).catch(
            (error) => {
                sdkPromise = null;
                throw error;
            }
        );
    }
    return sdkPromise;
}

function normalizeFingerprintQuality(event) {
    const value = event?.quality ?? event?.code ?? event?.qualityCode ?? event?.value ?? event;
    const quality = Number(value);
    return Number.isInteger(quality) && quality >= 0 && quality <= 100 ? quality : null;
}

/** El lector entrega la muestra como string, o como "[chunk][chunk]" URL-encoded. */
function normalizeSample(value) {
    const encoded = decodeURIComponent(String(value)).trim();
    if (!encoded.startsWith("[")) return encoded;
    try {
        return JSON.parse(encoded.replace(/]\s*\[/g, ",")).join("");
    } catch {
        return encoded;
    }
}

const deviceKey = (value) =>
    value && (typeof value === "string" ? value : value.deviceId || value.id || value.name || String(value));

export function useFingerprintReader({ vm, socket, onIdentified } = {}) {
    const { t } = useTranslation();
    const { run, setStatus, requirePersonId, refreshSummary } = vm;

    const [readerState, setReaderState] = useState(t("Comprobando lector..."));
    const [readerChecking, setReaderChecking] = useState(false);
    const [readerError, setReaderError] = useState(false);
    const [deviceReady, setDeviceReady] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [sampleReady, setSampleReady] = useState(false);
    const [quality, setQuality] = useState(null);

    const stateRef = useRef({
        api: null,
        channel: null,
        device: null,
        capturing: false,
        stopping: false,
        sample: null,
        quality: null,
        checking: false,
        pollTimer: null,
        disposed: false,
    });

    // El sondeo llama a la versión vigente de refreshReader sin autorreferenciarla.
    const refreshRef = useRef(null);

    const refreshReader = useCallback(
        async (silent = false) => {
            const state = stateRef.current;
            if (state.checking || state.disposed) return;
            state.checking = true;
            if (!silent) {
                setReaderChecking(true);
                setReaderError(false);
                setReaderState(t("Conectando con el runtime DigitalPersona de este equipo..."));
            }
            try {
                await loadDigitalPersonaSdk();
                let { api: fingerprintApi, channel } = state;
                if (!fingerprintApi) {
                    const webSdk = window.WebSdk;
                    const fingerprintSdk = window.Fingerprint;
                    if (!webSdk || !fingerprintSdk) throw new Error(t("No se cargaron los SDK web de DigitalPersona."));
                    channel = new webSdk.WebChannelClient(new webSdk.WebChannelOptions({}));
                    fingerprintApi = new fingerprintSdk.WebApi(channel);
                    await channel.connect();
                    state.api = fingerprintApi;
                    state.channel = channel;
                }
                const devices = await fingerprintApi.enumerateDevices();
                const device = devices?.[0] || null;
                const changed = deviceKey(state.device) !== deviceKey(device);
                state.device = device;
                if (changed) {
                    state.sample = null;
                    setSampleReady(false);
                }
                if (state.disposed) return;
                setDeviceReady(!!device);
                setReaderError(false);
                if (!silent || changed) {
                    setReaderState(
                        device
                            ? t("Lector DigitalPersona conectado.")
                            : t("Runtime conectado; esperando un lector DigitalPersona.")
                    );
                }
            } catch (error) {
                Object.assign(state, {
                    api: null,
                    channel: null,
                    device: null,
                    sample: null,
                    capturing: false,
                    stopping: false,
                });
                if (state.disposed) return;
                setCapturing(false);
                setSampleReady(false);
                setDeviceReady(false);
                setReaderError(true);
                setReaderState(`${t("No se pudo conectar con el runtime DigitalPersona")}: ${error.message}`);
            } finally {
                state.checking = false;
                if (!state.disposed && !state.pollTimer) {
                    state.pollTimer = setInterval(() => {
                        void refreshRef.current?.(true);
                    }, POLL_INTERVAL_MS);
                }
                if (!silent && !state.disposed) setReaderChecking(false);
            }
        },
        [t]
    );

    useEffect(() => {
        const state = stateRef.current;
        state.disposed = false;
        refreshRef.current = refreshReader;
        // Abre la conexión con el runtime DigitalPersona (sistema externo) al montar el módulo.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void refreshReader(false);
        return () => {
            state.disposed = true;
            clearInterval(state.pollTimer);
            state.pollTimer = null;
            // Suelta el lector y el canal con el runtime al salir del módulo.
            if (state.api && state.capturing) {
                Promise.resolve(state.api.stopAcquisition(state.device)).catch(() => {});
            }
            try {
                state.channel?.disconnect?.();
            } catch {
                /* canal ya cerrado */
            }
            Object.assign(state, { api: null, channel: null, device: null, sample: null, capturing: false });
        };
    }, [refreshReader]);

    const startCapture = useCallback(async () => {
        const state = stateRef.current;
        if (!state.api || !state.device) {
            setReaderState(t("Detecta un lector DigitalPersona antes de capturar."));
            return;
        }
        if (state.capturing) return;
        state.sample = null;
        state.stopping = false;
        setSampleReady(false);

        state.api.onQualityReported = (event) => {
            state.quality = normalizeFingerprintQuality(event);
            setQuality(state.quality);
        };
        state.api.onSamplesAcquired = async (event) => {
            if (state.sample || state.stopping) return;
            const sampleData = normalizeSample(event.samples);
            if (!sampleData) {
                setReaderState(t("El lector no devolvió una muestra válida. Intenta capturar de nuevo."));
                return;
            }
            state.sample = { format: event.sampleFormat ?? null, data: sampleData, quality: state.quality };
            setSampleReady(true);
            setReaderState(t("Huella capturada. Retira el dedo; ya puedes guardar o verificar."));
            state.stopping = true;
            try {
                await state.api.stopAcquisition(event.deviceUid || state.device);
                state.capturing = false;
                setCapturing(false);
            } catch (error) {
                setReaderState(
                    `${t("Huella capturada, pero no se pudo detener el lector")}: ${error.message}. ${t("Puedes guardar la muestra.")}`
                );
            } finally {
                state.stopping = false;
            }
        };
        state.api.onAcquisitionStarted = () => {
            state.capturing = true;
            setCapturing(true);
            setReaderState(t("Coloca el dedo en el lector..."));
        };
        state.api.onAcquisitionStopped = () => {
            state.capturing = false;
            setCapturing(false);
        };

        state.capturing = true;
        setCapturing(true);
        setQuality(null);
        setReaderState(t("Iniciando captura. Coloca el dedo en el lector..."));
        try {
            try {
                await state.api.startAcquisition(window.Fingerprint.SampleFormat.PngImage, state.device);
            } catch {
                await state.api.startAcquisition(window.Fingerprint.SampleFormat.PngImage);
            }
        } catch (error) {
            state.capturing = false;
            setCapturing(false);
            setReaderState(`${t("No se pudo iniciar la captura")}: ${error.message}`);
        }
    }, [t]);

    const stopCapture = useCallback(async () => {
        const state = stateRef.current;
        if (!state.api || !state.capturing) return;
        try {
            await state.api.stopAcquisition(state.device);
            state.capturing = false;
            setCapturing(false);
            setReaderState(
                state.sample
                    ? t("Lector detenido. La huella capturada está lista para guardar.")
                    : t("Captura detenida. Puedes iniciar una nueva captura.")
            );
        } catch (error) {
            setReaderState(`${t("No se pudo detener el lector")}: ${error.message}`);
        }
    }, [t]);

    const takeSample = () => {
        const sample = stateRef.current.sample;
        if (!sample) throw new Error(t("Captura una huella primero."));
        return sample;
    };

    const consumeSample = () => {
        stateRef.current.sample = null;
        setSampleReady(false);
    };

    const saveFingerprint = useCallback(
        () =>
            run(async () => {
                const sample = takeSample();
                const personId = requirePersonId();
                await biometricCaptureApi.enrollFingerprint({
                    personId,
                    fingerNumber: DEFAULT_FINGER_NUMBER,
                    sampleFormat: sample.format,
                    data: sample.data,
                    quality: sample.quality,
                });
                consumeSample();
                setStatus(t("Huella guardada en el servidor."), "ok");
                setReaderState(t("Muestra guardada en el servidor."));
                await refreshSummary();
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run, requirePersonId, setStatus, refreshSummary, t]
    );

    const loginFingerprint = useCallback(
        () =>
            run(async () => {
                const sample = takeSample();
                const data = socket
                    ? await socket.send("fingerprint.identify_sample", {
                          sample_format: sample.format,
                          data_base64: sample.data,
                          quality: sample.quality,
                          finger_number: sample.fingerNumber,
                      })
                    : await biometricCaptureApi.identifyFingerprint({
                          sampleFormat: sample.format,
                          data: sample.data,
                          quality: sample.quality,
                      });
                onIdentified?.(data);
                consumeSample();
                const persons = await personMap();
                const name = fullName(persons.get(data.person_id)) || data.person_id;
                setStatus(`${t("Huella reconocida")}: ${name}`, "ok");
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [run, setStatus, socket, onIdentified, t]
    );

    return {
        readerState,
        readerChecking,
        readerError,
        deviceReady,
        capturing,
        sampleReady,
        quality,
        detectReader: () => refreshReader(false),
        startCapture,
        stopCapture,
        saveFingerprint,
        loginFingerprint,
        __setSampleForTest: (sample) => {
            stateRef.current.sample = sample;
            setSampleReady(true);
        },
    };
}
