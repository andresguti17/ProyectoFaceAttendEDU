import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {FaceAuthService} from '../services/FaceAuthService';

// Misma prueba de vida que la web (Web/src/viewmodels/useFaceCapture.js):
//  - registro: 3 gestos aleatorios (parpadear / girar / abrir boca)
//  - cada gesto: 6 fotogramas (~280 ms) validados en /liveness-step, 2 intentos
//  - el token de reto se firma y caduca en el backend; la imagen enviada es el
//    fotograma central de toda la secuencia.
// Aquí los fotogramas salen de expo-camera en lugar de <video>/<canvas>.
const FRAMES_PER_GESTURE = 6;
const FRAME_INTERVAL_MS = 280;
const GESTURE_ATTEMPTS = 2;
const MAX_FRAME_WIDTH = 640;
export const REGISTER_GESTURES = 3;

const ACTION_KEYS = {
    blink: 'faceCapture.blink',
    turn: 'faceCapture.turn',
    open_mouth: 'faceCapture.openMouth',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "1920x1080" -> 1920. La web reescala a 640 px de ancho; en móvil se elige
// el tamaño de foto más cercano para no enviar imágenes de varios MB.
const sizeWidth = (size) => Number(String(size).split('x')[0]) || 0;

function pickPictureSize(sizes) {
    const valid = (sizes || []).filter((s) => sizeWidth(s) > 0);
    if (!valid.length) return undefined;
    const fitting = valid.filter((s) => sizeWidth(s) <= MAX_FRAME_WIDTH);
    const pool = fitting.length ? fitting : valid;
    return pool.reduce((best, s) =>
        (fitting.length ? sizeWidth(s) > sizeWidth(best) : sizeWidth(s) < sizeWidth(best)) ? s : best
    );
}

export function useFaceLivenessCapture() {
    const {t} = useTranslation();
    const cameraRef = useRef(null);

    const [cameraReady, setCameraReady] = useState(false);
    const [pictureSize, setPictureSize] = useState(undefined);
    const [busy, setBusy] = useState(false);
    const [status, setStatusState] = useState({message: '', tone: 'info'});
    const [livenessAction, setLivenessAction] = useState('');
    const [livenessProgress, setLivenessProgress] = useState(null); // { done, total }

    const setStatus = useCallback((message, tone = 'info') => setStatusState({message, tone}), []);

    const handleCameraReady = useCallback(async () => {
        setCameraReady(true);
        try {
            const sizes = await cameraRef.current?.getAvailablePictureSizesAsync?.();
            setPictureSize(pickPictureSize(sizes));
        } catch {
            setPictureSize(undefined);
        }
    }, []);

    const resetCamera = useCallback(() => setCameraReady(false), []);

    const captureFrame = useCallback(async () => {
        const camera = cameraRef.current;
        if (!camera) throw new Error(t('faceCapture.cameraNotReady'));
        const takePicture = camera.takePictureAsync || camera.takePhotoAsync;
        const photo = await takePicture.call(camera, {
            base64: true,
            quality: 0.6,
            shutterSound: false,
            skipProcessing: true,
        });
        return `data:image/jpeg;base64,${photo.base64}`;
    }, [t]);

    const resetLiveness = useCallback(() => {
        setLivenessAction('');
        setLivenessProgress(null);
    }, []);

    const captureLiveness = useCallback(async (gestureCount) => {
        const challenge = await FaceAuthService.getLivenessChallenge(gestureCount);
        let token = challenge.challenge_token;
        const frames = [];
        const total = challenge.actions.length;
        for (let actionIndex = 0; actionIndex < total; actionIndex += 1) {
            const action = challenge.actions[actionIndex];
            let complete = false;
            for (let attempt = 0; attempt < GESTURE_ATTEMPTS && !complete; attempt += 1) {
                const label = t(ACTION_KEYS[action] || 'faceCapture.followInstruction');
                setLivenessAction(attempt ? `${label} (${t('faceCapture.repeatGesture')})` : label);
                setLivenessProgress({done: actionIndex, total});
                await wait(350);
                const actionFrames = [];
                for (let frame = 0; frame < FRAMES_PER_GESTURE; frame += 1) {
                    const startedAt = Date.now();
                    actionFrames.push(await captureFrame());
                    const elapsed = Date.now() - startedAt;
                    if (frame < FRAMES_PER_GESTURE - 1) await wait(Math.max(0, FRAME_INTERVAL_MS - elapsed));
                }
                try {
                    const result = await FaceAuthService.submitLivenessStep({
                        challengeToken: token,
                        actionIndex,
                        images: actionFrames,
                    });
                    frames.push(...actionFrames);
                    token = result.challenge_token;
                    complete = true;
                    setLivenessProgress({done: actionIndex + 1, total});
                } catch (requestError) {
                    if (attempt === GESTURE_ATTEMPTS - 1) throw requestError;
                    setStatus(`${requestError.message}. ${t('faceCapture.repeatSameGesture')}`, 'error');
                }
            }
        }
        resetLiveness();
        return {challengeToken: token, image: frames[Math.floor(frames.length / 2)]};
    }, [captureFrame, resetLiveness, setStatus, t]);

    /** Registra (o reemplaza) el rostro de personId; devuelve true si quedó guardado. */
    const registerFace = useCallback(async (personId) => {
        if (busy) return false;
        if (!personId) {
            setStatus(t('faceCapture.missingPerson'), 'error');
            return false;
        }
        setBusy(true);
        try {
            setStatus(t('faceCapture.registerIntro', {count: REGISTER_GESTURES}));
            const liveness = await captureLiveness(REGISTER_GESTURES);
            setStatus(t('faceCapture.registering'));
            await FaceAuthService.enrollFace({
                personId,
                imageBase64: liveness.image,
                challengeToken: liveness.challengeToken,
            });
            setStatus(t('faceCapture.registered'), 'ok');
            return true;
        } catch (error) {
            setStatus(error?.message || t('faceCapture.genericError'), 'error');
            return false;
        } finally {
            resetLiveness();
            setBusy(false);
        }
    }, [busy, captureLiveness, resetLiveness, setStatus, t]);

    return {
        cameraRef,
        cameraReady,
        pictureSize,
        handleCameraReady,
        resetCamera,
        busy,
        status,
        setStatus,
        livenessAction,
        livenessProgress,
        registerFace,
    };
}
