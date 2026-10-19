// ============================================================
//  FaceAttend EDU — FaceRegistrationModal (Orquestador)
//
//  Modal de registro facial con face-api.js
//
//  Flujo: options → camera → confirm → done
//
//  Este archivo orquesta los sub-componentes y mantiene el estado.
//  Los sub-componentes están en archivos separados para mejor mantenibilidad.
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Modal, View, TouchableOpacity, Platform } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useResponsive } from "../../hooks/useResponsive";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

// Utilidades face-api
import { loadFaceApi, analyzeFrame, cropFace, downloadJson } from "./faceApiUtils";

// Sub-componentes
import OptionsStep from "./OptionsStep";
import CameraStep from "./CameraStep";
import ConfirmStep from "./ConfirmStep";
import DoneStep from "./DoneStep";

export default function FaceRegistrationModal({
    visible,
    studentName,
    studentId,
    onClose,
    onConfirm,
}) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;

    // Estados del modal
    const [step, setStep] = useState("options");
    const [camState, setCamState] = useState("idle");
    const [modelState, setModelState] = useState("idle");

    // Referencias
    const videoRef = useRef(null);
    const workCanvas = useRef(null);
    const overlayRef = useRef(null);
    const streamRef = useRef(null);
    const loopRef = useRef(null);
    const fileRef = useRef(null);

    // Estados de análisis
    const [quality, setQuality] = useState({
        faceFound: false,
        centered: false,
        sizeOk: false,
        brightOk: false,
        frontal: false,
        pitchOk: false,
        eyesOpen: false,
    });
    const [stableCount, setStableCount] = useState(0);
    const [allQOk, setAllQOk] = useState(false);
    const [capturedUrl, setCapturedUrl] = useState(null);
    const [descriptor, setDescriptor] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [loadError, setLoadError] = useState(null);

    const STABLE_TARGET = 8; // ~1.5s

    // -- Reset -----------------------------------------

    const stopStream = useCallback(() => {
        if (loopRef.current) {
            cancelAnimationFrame(loopRef.current);
            loopRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    const resetAll = useCallback(() => {
        stopStream();
        setStep("options");
        setCamState("idle");
        setModelState("idle");
        setQuality({
            faceFound: false,
            centered: false,
            sizeOk: false,
            brightOk: false,
            frontal: false,
            pitchOk: false,
            eyesOpen: false,
        });
        setStableCount(0);
        setAllQOk(false);
        setCapturedUrl(null);
        setDescriptor(null);
        setProcessing(false);
        setLoadError(null);
    }, [stopStream]);

    useEffect(() => {
        if (!visible) resetAll();
    }, [visible, resetAll]);

    // -- Loop de detección ~5fps ------------------------

    const analysisLoop = useCallback(async () => {
        if (!videoRef.current || !workCanvas.current || camState !== "analyzing") return;

        const result = await analyzeFrame(videoRef.current, workCanvas.current);
        setQuality(result);

        const ok =
            result.faceFound &&
            result.centered &&
            result.sizeOk &&
            result.brightOk &&
            result.frontal &&
            result.pitchOk &&
            result.eyesOpen;

        setAllQOk(ok);

        if (ok) {
            setStableCount((prev) => {
                const next = prev + 1;
                if (next >= STABLE_TARGET) {
                    setCamState("captured");
                    stopStream();
                    const cropped = cropFace(workCanvas.current, result.bbox, result.landmarks);
                    setCapturedUrl(cropped);
                    setDescriptor({
                        version: "faceattend-v1",
                        studentId: studentId,
                        studentName: studentName,
                        timestamp: Date.now(),
                        descriptor: result.descriptor,
                    });
                    setStep("confirm");
                    return 0;
                }
                return next;
            });
        } else {
            setStableCount(0);
        }

        loopRef.current = requestAnimationFrame(() => {
            setTimeout(analysisLoop, 200);
        });
    }, [camState, stopStream, studentId, studentName]);

    useEffect(() => {
        if (camState === "analyzing") {
            analysisLoop();
        }
        return () => {
            if (loopRef.current) {
                cancelAnimationFrame(loopRef.current);
                loopRef.current = null;
            }
        };
    }, [camState, analysisLoop]);

    // -- Iniciar cámara --------------------------------

    const startCamera = useCallback(async () => {
        setStep("camera");
        setCamState("requesting");
        setModelState("loading");

        const modelPath = Platform.OS === "web" ? "/models" : "/models";
        const loaded = await loadFaceApi(modelPath);
        if (!loaded) {
            setModelState("error");
            return;
        }
        setModelState("ready");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setCamState("analyzing");
        } catch (err) {
            console.warn("[camera] Error:", err);
            setCamState("error");
        }
    }, []);

    // -- Carga de archivo ------------------------------

    const openFilePicker = useCallback(() => fileRef.current?.click(), []);

    const handleFileLoad = useCallback(
        async (e) => {
            const file = e.target?.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (data.version !== "faceattend-v1" || !Array.isArray(data.descriptor) || data.descriptor.length !== 128) {
                    setLoadError(t("Formato inválido. Debe ser faceattend-v1 con descriptor de 128 floats."));
                    return;
                }
                setLoadError(null);
                setDescriptor(data);
                setStep("done");
            } catch {
                setLoadError(t("Error al leer el archivo. Verifica que sea un JSON válido."));
            }
        },
        [t]
    );

    // -- Handlers de navegación ------------------------

    const handleRetake = useCallback(() => {
        setCapturedUrl(null);
        setDescriptor(null);
        startCamera();
    }, [startCamera]);

    const handleConfirm = useCallback(async () => {
        if (!descriptor) return;
        setProcessing(true);
        await new Promise((resolve) => setTimeout(resolve, 800));
        setProcessing(false);
        setStep("done");
    }, [descriptor]);

    const handleFinalConfirm = useCallback(() => {
        onConfirm(descriptor);
        resetAll();
    }, [descriptor, onConfirm, resetAll]);

    const handleDownload = useCallback(() => {
        if (descriptor) downloadJson(descriptor);
    }, [descriptor]);

    if (!visible) return null;

    const stableProgress = STABLE_TARGET > 0 ? Math.min(1, stableCount / STABLE_TARGET) : 0;

    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
            <TouchableOpacity
                style={{
                    flex: 1,
                    backgroundColor: c.background.overlay,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: isSmall ? 12 : 24,
                }}
                onPress={onClose}
                activeOpacity={1}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                    style={{
                        backgroundColor: c.background.surface,
                        borderRadius: 14,
                        width: isSmall ? "100%" : step === "camera" ? 680 : 520,
                        maxHeight: "92%",
                        overflow: "hidden",
                        shadowColor: "#000",
                        shadowOpacity: 0.18,
                        shadowRadius: 12,
                        elevation: 12,
                    }}
                >
                    {step === "options" && (
                        <OptionsStep
                            c={c}
                            t={t}
                            onCamera={startCamera}
                            onFileLoad={openFilePicker}
                            loadError={loadError}
                        />
                    )}

                    {step === "camera" && (
                        <CameraStep
                            c={c}
                            t={t}
                            camState={camState}
                            modelState={modelState}
                            videoRef={videoRef}
                            workCanvas={workCanvas}
                            overlayRef={overlayRef}
                            quality={quality}
                            stableProgress={stableProgress}
                            allQOk={allQOk}
                            onCapture={() => {}}
                            onBack={() => {
                                stopStream();
                                setStep("options");
                            }}
                        />
                    )}

                    {step === "confirm" && (
                        <ConfirmStep
                            c={c}
                            t={t}
                            capturedUrl={capturedUrl}
                            processing={processing}
                            onRetake={handleRetake}
                            onConfirm={handleConfirm}
                        />
                    )}

                    {step === "done" && (
                        <DoneStep
                            c={c}
                            t={t}
                            descriptor={descriptor}
                            onDownload={handleDownload}
                            onConfirm={handleFinalConfirm}
                        />
                    )}

                    {/* Input oculto para carga de archivo */}
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".json"
                        style={{ display: "none" }}
                        onChange={handleFileLoad}
                    />
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}
