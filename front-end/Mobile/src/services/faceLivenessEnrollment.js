import {FaceAuthService} from './FaceAuthService';

// Debe coincidir con FRAMES_PER_ACTION del backend
// (back-end/06-ms-biometric/infrastructure/web/routers/facial_router.py):
// LivenessStepRequest.images exige EXACTAMENTE este número de fotogramas.
export const FRAMES_PER_GESTURE = 6;
// Igual que Web (useFaceCapture.js): si un gesto no se detecta, se permite
// repetirlo una vez antes de abortar todo el registro.
export const GESTURE_ATTEMPTS = 2;
// Pausa real entre fotogramas de un mismo gesto, para darle tiempo al
// estudiante a completar el movimiento (parpadear, girar, abrir la boca).
export const FRAME_INTERVAL_MS = 220;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Orquesta el reto de vida completo (N gestos, FRAMES_PER_GESTURE fotogramas
 * por gesto, hasta GESTURE_ATTEMPTS intentos por gesto si uno falla) y, al
 * terminar, enrola el rostro usando el fotograma central de toda la
 * secuencia — igual que useFaceCapture.js en Web, para que el mismo backend
 * reciba exactamente la misma forma de datos desde ambas plataformas.
 *
 * `captureFrame` es responsabilidad del llamador (lee cameraRef.current):
 * debe devolver una promesa de un fotograma en base64 (con o sin el prefijo
 * "data:image/...;base64,", el backend acepta ambos).
 */
export async function enrollFaceWithLiveness({
    personId,
    gestureCount = 3,
    captureFrame,
    translateActionLabel,
    onGestureStart,
    onGestureRetry,
}) {
    const challenge = await FaceAuthService.getLivenessChallenge(gestureCount);
    let challengeToken = challenge.challenge_token;
    const frames = [];
    const total = challenge.actions.length;

    for (let actionIndex = 0; actionIndex < total; actionIndex += 1) {
        const action = challenge.actions[actionIndex];
        let complete = false;

        for (let attempt = 0; attempt < GESTURE_ATTEMPTS && !complete; attempt += 1) {
            const label = translateActionLabel(action, attempt > 0);
            onGestureStart?.(label, {done: actionIndex, total});

            const actionFrames = [];
            for (let frame = 0; frame < FRAMES_PER_GESTURE; frame += 1) {
                actionFrames.push(await captureFrame());
                if (frame < FRAMES_PER_GESTURE - 1) await wait(FRAME_INTERVAL_MS);
            }

            try {
                const result = await FaceAuthService.submitLivenessStep({
                    challengeToken,
                    actionIndex,
                    images: actionFrames,
                });
                frames.push(...actionFrames);
                challengeToken = result.challenge_token;
                complete = true;
                onGestureStart?.(label, {done: actionIndex + 1, total});
            } catch (error) {
                if (attempt === GESTURE_ATTEMPTS - 1) throw error;
                onGestureRetry?.(error.message);
            }
        }
    }

    const enrollImage = frames[Math.floor(frames.length / 2)];
    return FaceAuthService.enrollFace({personId, imageBase64: enrollImage, challengeToken});
}
