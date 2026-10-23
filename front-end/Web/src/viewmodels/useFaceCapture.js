// ============================================================
//  FaceAttend EDU — useFaceCapture
//
//  Cámara + prueba de vida + registro/reconocimiento de rostro.
//  Lógica portada de face-auth (App.js) sin cambios de comportamiento:
//   - registro: 1 gesto aleatorio (parpadear / girar / abrir boca)
//   - reconocimiento: 2 gestos
//   - cada gesto: 6 fotogramas (~280 ms) validados en /liveness-step, 2 intentos
//   - el token de reto se firma y caduca en el backend; la imagen enviada es el
//     fotograma central de toda la secuencia.
//  Solo web: usa getUserMedia, <video> y <canvas>.
// ============================================================

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { NavigationContext } from "@react-navigation/native";
import { biometricCaptureApi } from "../services/api/biometricCaptureApi";
import { personMap, fullName } from "../services/api/referenceData";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";

const FRAMES_PER_GESTURE = 6;
const FRAME_INTERVAL_MS = 280;
const GESTURE_ATTEMPTS = 2;
const MAX_FRAME_WIDTH = 640;

const ACTION_LABELS = {
    blink: "Parpadea una vez",
    turn: "Gira lentamente la cabeza",
    // Izquierda/derecha son las de la persona; la vista previa está en espejo, así que
    // en pantalla la cara se mueve hacia ese mismo lado.
    turn_left: "Gira lentamente la cabeza hacia tu izquierda",
    turn_right: "Gira lentamente la cabeza hacia tu derecha",
    open_mouth: "Abre y cierra la boca",
    smile: "Sonríe",
    nod: "Asiente con la cabeza (arriba y abajo)",
};

// Gestos que esta pantalla sabe indicar; el backend solo sorteará entre ellos.
export const SUPPORTED_LIVENESS_ACTIONS = Object.keys(ACTION_LABELS).filter((action) => action !== "turn");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const CAMERA_SUPPORTED =
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

export function useFaceCapture({ vm, socket, onIdentified } = {}) {
    const { t } = useTranslation();
    const { run, setStatus, requirePersonId, refreshSummary } = vm;

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    // La pantalla sigue montada bajo la siguiente del stack al cambiar de
    // sección, así que el cleanup de desmontaje no basta para soltar la cámara.
    const navigation = useContext(NavigationContext);
    const unfocusedRef = useRef(false);
    const resumeOnFocusRef = useRef(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [livenessAction, setLivenessAction] = useState("");
    const [livenessProgress, setLivenessProgress] = useState(null); // { done, total }

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraReady(false);
    }, []);

    // Suelta la cámara al salir del módulo.
    useEffect(
        () => () => {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        },
        []
    );

    const startCamera = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus(
                t("Este navegador no permite acceder a la cámara. En redes remotas la página debe servirse por HTTPS."),
                "error"
            );
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: "user" },
                audio: false,
            });
            // El permiso pudo resolverse cuando ya se había salido de la pantalla.
            if (unfocusedRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            streamRef.current = stream;
            const video = videoRef.current;
            if (!video) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            video.srcObject = stream;
            await video.play();
            setCameraReady(true);
            setStatus(t("Cámara lista. Ya puedes registrar o verificar tu rostro."));
        } catch (cameraError) {
            const reason =
                cameraError.name === "NotAllowedError"
                    ? t("El permiso de la cámara fue denegado. Actívalo en la configuración del navegador y vuelve a intentarlo.")
                    : cameraError.name === "NotFoundError"
                      ? t("No se encontró ninguna cámara disponible.")
                      : cameraError.name === "NotReadableError"
                        ? t("La cámara está siendo usada por otra aplicación.")
                        : `${t("No se pudo acceder a la cámara")}: ${cameraError.message}`;
            setStatus(reason, "error");
        }
    }, [setStatus, t]);

    // Al salir de la sección se apaga la cámara; al volver se reanuda solo si
    // estaba encendida (el kiosco la enciende sola, Biometría la enciende a mano).
    useEffect(() => {
        if (!navigation?.addListener) return undefined;
        const unsubscribeBlur = navigation.addListener("blur", () => {
            unfocusedRef.current = true;
            resumeOnFocusRef.current = streamRef.current != null;
            stopCamera();
        });
        const unsubscribeFocus = navigation.addListener("focus", () => {
            unfocusedRef.current = false;
            if (resumeOnFocusRef.current) {
                resumeOnFocusRef.current = false;
                startCamera();
            }
        });
        return () => {
            unsubscribeBlur();
            unsubscribeFocus();
        };
    }, [navigation, startCamera, stopCamera]);

    const captureFrame = useCallback(() => {
        const video = videoRef.current;
        if (!video?.videoWidth) throw new Error(t("La cámara aún no está lista"));
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.82);
    }, [t]);

    const resetLiveness = useCallback(() => {
        setLivenessAction("");
        setLivenessProgress(null);
    }, []);

    const captureLiveness = useCallback(
        async (gestureCount) => {
            const challenge = await biometricCaptureApi.livenessChallenge(
                gestureCount,
                SUPPORTED_LIVENESS_ACTIONS
            );
            let token = challenge.challenge_token;
            const frames = [];
            const total = challenge.actions.length;
            for (let actionIndex = 0; actionIndex < total; actionIndex += 1) {
                const action = challenge.actions[actionIndex];
                let complete = false;
                for (let attempt = 0; attempt < GESTURE_ATTEMPTS && !complete; attempt += 1) {
                    const label = t(ACTION_LABELS[action] || "Sigue la instrucción");
                    setLivenessAction(attempt ? `${label} (${t("repite el gesto")})` : label);
                    setLivenessProgress({ done: actionIndex, total });
                    await wait(350);
                    const actionFrames = [];
                    for (let frame = 0; frame < FRAMES_PER_GESTURE; frame += 1) {
                        actionFrames.push(captureFrame());
                        if (frame < FRAMES_PER_GESTURE - 1) await wait(FRAME_INTERVAL_MS);
                    }
                    try {
                        const result = await biometricCaptureApi.livenessStep({
                            challengeToken: token,
                            actionIndex,
                            images: actionFrames,
                        });
                        // El servidor responde 200 con detected:false (no un 4xx) cuando no
                        // vio el gesto: cuenta como intento fallido y no avanza el reto.
                        if (result?.detected === false) throw new Error("Liveness gesture not detected");
                        frames.push(...actionFrames);
                        token = result.challenge_token;
                        complete = true;
                        setLivenessProgress({ done: actionIndex + 1, total });
                    } catch (requestError) {
                        if (attempt === GESTURE_ATTEMPTS - 1) throw requestError;
                        setStatus(`${requestError.message}. ${t("Repite el mismo gesto.")}`, "error");
                    }
                }
            }
            resetLiveness();
            return { challengeToken: token, image: frames[Math.floor(frames.length / 2)] };
        },
        [captureFrame, resetLiveness, setStatus, t]
    );

    const withLiveness = useCallback(
        (operation) =>
            run(async () => {
                try {
                    await operation();
                } finally {
                    resetLiveness();
                }
            }),
        [run, resetLiveness]
    );

    const registerFace = useCallback(
        () =>
            withLiveness(async () => {
                const personId = requirePersonId();
                setStatus(t("Te pediremos un gesto para registrar el rostro."));
                const liveness = await captureLiveness(1);
                setStatus(t("Registrando rostro..."));
                await biometricCaptureApi.enrollFace({
                    personId,
                    imageBase64: liveness.image,
                    challengeToken: liveness.challengeToken,
                });
                setStatus(t("Rostro registrado"), "ok");
                await refreshSummary();
            }),
        [withLiveness, requirePersonId, setStatus, captureLiveness, refreshSummary, t]
    );

    const loginFace = useCallback(
        () =>
            withLiveness(async () => {
                setStatus(t("Te pediremos 2 gestos para reconocer el rostro."));
                const liveness = await captureLiveness(2);
                setStatus(t("Verificando rostro..."));
                const data = socket
                    ? await socket.send("facial.identify_image", {
                          image_base64: liveness.image,
                          challenge_token: liveness.challengeToken,
                      })
                    : await biometricCaptureApi.identifyFace({
                          imageBase64: liveness.image,
                          challengeToken: liveness.challengeToken,
                      });
                onIdentified?.(data);
                const persons = await personMap();
                const name = fullName(persons.get(data.person_id)) || data.person_id;
                setStatus(`${t("Persona reconocida")}: ${name}`, "ok");
            }),
        [withLiveness, setStatus, captureLiveness, socket, onIdentified, t]
    );

    return {
        videoRef,
        cameraReady,
        startCamera,
        stopCamera,
        livenessAction,
        livenessProgress,
        registerFace,
        loginFace,
    };
}
