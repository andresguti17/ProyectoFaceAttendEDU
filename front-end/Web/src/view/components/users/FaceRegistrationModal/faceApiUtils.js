// ============================================================
//  FaceAttend EDU — Face API Utilities
//
//  Utilidades para detección facial con @vladmandic/face-api:
//  - Carga de modelos
//  - Análisis de frame (detección + validaciones)
//  - Recorte facial con máscara elíptica
//  - Descarga de JSON
// ============================================================

import { Platform } from "react-native";

let faceapiModule = null;
let modelsLoaded = false;

/**
 * Carga los modelos de face-api desde la ruta especificada
 */
export async function loadFaceApi(modelPath) {
    if (modelsLoaded && faceapiModule) return true;
    try {
        // Import dinámico para no bloquear el bundle inicial
        faceapiModule = await import("@vladmandic/face-api");
        const fa = faceapiModule;
        await Promise.all([
            fa.nets.ssdMobilenetv1.loadFromUri(modelPath),
            fa.nets.faceLandmark68Net.loadFromUri(modelPath),
            fa.nets.faceRecognitionNet.loadFromUri(modelPath),
        ]);
        modelsLoaded = true;
        return true;
    } catch (e) {
        console.warn("[face-api] Error cargando modelos:", e);
        return false;
    }
}

/**
 * Analiza un frame de video y retorna información del rostro detectado
 */
export async function analyzeFrame(video, workCanvas) {
    const W = video.videoWidth || 640;
    const H = video.videoHeight || 480;
    workCanvas.width = W;
    workCanvas.height = H;
    const ctx = workCanvas.getContext("2d");
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();

    // -- Brillo --------------------------------------------
    const sid = ctx.getImageData(W * 0.2, H * 0.1, W * 0.6, H * 0.8);
    let lum = 0;
    for (let i = 0; i < sid.data.length; i += 16) {
        lum += 0.299 * sid.data[i] + 0.587 * sid.data[i + 1] + 0.114 * sid.data[i + 2];
    }
    lum /= sid.data.length / 16;
    const brightOk = lum > 45 && lum < 215;

    const FAIL = {
        faceFound: false,
        centered: false,
        sizeOk: false,
        brightOk,
        frontal: false,
        pitchOk: false,
        eyesOpen: false,
        bbox: null,
        descriptor: null,
        landmarks: null,
    };

    if (!faceapiModule || !modelsLoaded) return FAIL;

    const fa = faceapiModule;
    try {
        const detection = await fa
            .detectSingleFace(workCanvas, new fa.SsdMobilenetv1Options({ minConfidence: 0.65 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) return FAIL;

        const { x, y, width, height } = detection.detection.box;
        const bbox = { x, y, w: width, h: height };

        const cx = x + width / 2;
        const cy = y + height / 2;

        // -- Centrado estricto -----------------------------
        const centered = cx > W * 0.30 && cx < W * 0.70 && cy > H * 0.20 && cy < H * 0.75;

        // -- Tamaño mínimo: la cara debe ocupar >=22% del alto -
        const sizeOk = height / H >= 0.22 && width / W >= 0.15;

        const lm = detection.landmarks.positions;

        // -- Ángulo frontal (yaw) -------------------------
        const noseTip = lm[30];
        const earL = lm[0];
        const earR = lm[16];
        const distL = Math.abs(noseTip.x - earL.x);
        const distR = Math.abs(noseTip.x - earR.x);
        const maxDist = Math.max(distL, distR);
        const yawRatio = maxDist > 0 ? Math.abs(distL - distR) / maxDist : 1;
        const frontal = yawRatio < 0.28;

        // -- Inclinación vertical (pitch) -----------------
        const eyeLY = (lm[37].y + lm[38].y + lm[40].y + lm[41].y) / 4;
        const eyeRY = (lm[43].y + lm[44].y + lm[46].y + lm[47].y) / 4;
        const eyeAvgY = (eyeLY + eyeRY) / 2;
        const eyeNoseNorm = (noseTip.y - eyeAvgY) / height;
        const pitchOk = eyeNoseNorm > 0.22 && eyeNoseNorm < 0.50;

        // -- Ojos abiertos --------------------------------
        const earEye = (pts) => {
            const [p1, p2, p3, p4, p5, p6] = pts.map((i) => lm[i]);
            const A = Math.hypot(p2.x - p6.x, p2.y - p6.y);
            const B = Math.hypot(p3.x - p5.x, p3.y - p5.y);
            const C = Math.hypot(p1.x - p4.x, p1.y - p4.y);
            return C > 0 ? (A + B) / (2 * C) : 0;
        };
        const earLeft = earEye([36, 37, 38, 39, 40, 41]);
        const earRight = earEye([42, 43, 44, 45, 46, 47]);
        const earAvg = (earLeft + earRight) / 2;
        const eyesOpen = earAvg > 0.20;

        const desc = Array.from(detection.descriptor);
        const lmPoints = lm.map((p) => ({ x: p.x, y: p.y }));

        return {
            faceFound: true,
            centered,
            sizeOk,
            brightOk,
            frontal,
            pitchOk,
            eyesOpen,
            bbox,
            descriptor: desc,
            landmarks: lmPoints,
        };
    } catch {
        return FAIL;
    }
}

/**
 * Recorta el rostro del canvas con máscara elíptica
 */
export function cropFace(src, bbox, _landmarks) {
    if (!bbox) return src.toDataURL("image/jpeg", 0.9);

    // Márgenes ajustados — recorte más ceñido al rostro
    const mX = bbox.w * 0.52;
    const mYt = bbox.h * 0.68;
    const mYb = bbox.h * 0.35;

    const sx = Math.max(0, Math.round(bbox.x - mX));
    const sy = Math.max(0, Math.round(bbox.y - mYt));
    const ex = Math.min(src.width, Math.round(bbox.x + bbox.w + mX));
    const ey = Math.min(src.height, Math.round(bbox.y + bbox.h + mYb));
    const sw = ex - sx;
    const sh = ey - sy;

    // Canvas de salida = solo el recorte
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext("2d");
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);

    // Máscara elíptica
    const mask = document.createElement("canvas");
    mask.width = sw;
    mask.height = sh;
    const mctx = mask.getContext("2d");

    const cx = sw / 2;
    const cy = sh * 0.46;
    const rx = sw * 0.46;
    const ry = sh * 0.50;

    mctx.beginPath();
    mctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    mctx.fillStyle = "#fff";
    mctx.fill();

    // Blur en canvas intermedio para bordes suaves
    const blurred = document.createElement("canvas");
    blurred.width = sw;
    blurred.height = sh;
    const bctx = blurred.getContext("2d");
    bctx.filter = "blur(10px)";
    bctx.drawImage(mask, 0, 0);
    bctx.filter = "none";

    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(blurred, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    return out.toDataURL("image/png");
}

/**
 * Descarga un objeto como JSON
 */
export function downloadJson(data) {
    if (Platform.OS !== "web") return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `face_${data.studentId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
