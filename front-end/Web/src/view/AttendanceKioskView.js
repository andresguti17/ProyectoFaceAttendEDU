// ============================================================
//  FaceAttend EDU — AttendanceKioskView
//
//  Pantalla «Kiosco de asistencia»: el profesor abre la clase de hoy
//  y, a partir de ahí, cada estudiante se identifica por rostro
//  (ciclo pasivo, sin tocar nada) o por huella (botón explícito).
//  Backend: ms-biometric (WebSocket) + ms-attendance/ms-scheduling.
//
//  `useAttendanceKioskViewModel().view` solo puede valer
//  SELECT_SESSION / WAITING / SUCCESS / DUPLICATE / ERROR — no sabe
//  si hay una captura facial o de huella en curso, porque eso depende
//  de qué hook de captura está corriendo en ESTA pantalla, no de la
//  sesión de clase. Por eso el estado "¿qué se está capturando ahora?"
//  (activeCapture) vive aquí, local, y solo afecta al banner cuando
//  kioskVm.view sigue en WAITING.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Text, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
// Importados desde sus archivos concretos, no desde el barrel
// `./components/common` — ese índice agrega `./navigation` y `./tabs`,
// que ambos re-exportan un `Tabs` distinto; al evaluarse juntos lanzan
// `TypeError: Cannot redefine property: Tabs` (bug preexistente, fuera
// de alcance de esta tarea). Nada en este archivo necesita ese barrel.
import { PageHeader } from "./components/common/navigation/PageHeader";
import { Card } from "./components/common/cards/Card";
import { Button } from "./components/common/buttons/Button";
import { useTheme } from "./components/hooks/useTheme";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useAttendanceKioskViewModel } from "../viewmodels/useAttendanceKioskViewModel";
import { useRolePermissions } from "../viewmodels/useRolePermissions";
import { useFaceCapture, CAMERA_SUPPORTED } from "../viewmodels/useFaceCapture";
import { useFingerprintReader } from "../viewmodels/useFingerprintReader";
import { ConfirmModal } from "./components/common/modals/ConfirmModal";
import ClassCard from "./components/kiosk/ClassCard";
import { getInstitutionConfig, onInstitutionConfigChange } from "../core/config/institutionConfig";

const TONE_COLOR_KEY = {
    default: "secondary",
    primary: "brand",
    success: "success",
    warning: "warning",
    danger: "danger",
};

// Cuánto se espera antes de reintentar arrancar un intento de rostro
// cuando el "slot" de captura ya está ocupado por una huella en curso.
const FACE_RETRY_WAIT_MS = 200;
const FACE_MAX_BACKOFF_MS = 5000;
// Si se arma el lector de huella y nadie pone el dedo, no se puede quedar
// esperando para siempre — ni tampoco bloqueado el ciclo pasivo de rostro.
const FINGERPRINT_ARM_TIMEOUT_MS = 15000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function toneColor(colors, tone) {
    switch (TONE_COLOR_KEY[tone]) {
        case "brand":
            return colors.brand.primary;
        case "success":
            return colors.status.success;
        case "warning":
            return colors.status.warning;
        case "danger":
            return colors.status.danger;
        default:
            return colors.text.secondary;
    }
}

function SelectSessionPanel({ kioskVm }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={t("Tomar asistencia")}
                subtitle={t("Selecciona la clase de hoy para abrir el kiosco")}
            />
            <ScrollView
                contentContainerStyle={{ padding: 24, gap: 16, alignItems: "center" }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ width: "100%", maxWidth: 640, gap: 12 }}>
                    {!!kioskVm.statusMessage && (
                        <Card padding="md" style={{ borderColor: c.status.danger, borderWidth: 1 }}>
                            <Text style={{ color: c.status.danger, fontSize: 13 }}>{kioskVm.statusMessage}</Text>
                        </Card>
                    )}
                    {kioskVm.todaysBlocks.length === 0 ? (
                        <Card padding="lg">
                            <View style={{ alignItems: "center", gap: 8, paddingVertical: 16 }}>
                                <Feather name="calendar" size={32} color={c.text.secondary} />
                                <Text style={{ color: c.text.secondary, fontSize: 14, textAlign: "center" }}>
                                    {t("No tienes clases programadas para hoy")}
                                </Text>
                            </View>
                        </Card>
                    ) : (
                        kioskVm.todaysBlocks.map((block) => (
                            <ClassCard
                                key={block.scheduleBlockId}
                                block={block}
                                details={kioskVm.classCards?.get(block.scheduleBlockId)}
                                loading={kioskVm.classCardsLoading}
                                onStart={kioskVm.startClass}
                            />
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

// Panel lateral junto a la cámara: lista de estudiantes matriculados en la
// cohorte de esta clase y quiénes ya registraron asistencia (y con qué
// método). Con canCorrectAttendance permite corregir a Tarde y quitar el
// registro (HU-ATT-003, attendance.record:write).
function RosterPanel({ kioskVm, canCorrect, onCorrect, onRemove }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const methodLabel = { FACIAL: t("Rostro"), FINGERPRINT: t("Huella") };

    return (
        <Card padding="lg" style={{ width: "100%", maxWidth: 320 }} contentStyle={{ gap: 4 }}>
            <Text style={{ color: c.text.primary, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
                {t("Estudiantes")} ({kioskVm.registeredActorIds.size}/{kioskVm.roster.length})
            </Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {kioskVm.roster.length === 0 ? (
                    <Text style={{ color: c.text.secondary, fontSize: 13 }}>
                        {t("Sin estudiantes matriculados en esta ficha")}
                    </Text>
                ) : (
                    kioskVm.roster.map((student) => {
                        const method = kioskVm.registeredMethods.get(student.academicActorId);
                        const present = kioskVm.registeredActorIds.has(student.academicActorId);
                        const late = kioskVm.lateActorIds?.has(student.academicActorId) ?? false;
                        return (
                            <View
                                key={student.academicActorId}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                    paddingVertical: 8,
                                    borderBottomWidth: 1,
                                    borderBottomColor: c.border.primary,
                                }}
                            >
                                <Feather
                                    name={present ? "check-circle" : "circle"}
                                    size={16}
                                    color={present ? c.status.success : c.text.secondary}
                                />
                                <Text style={{ color: c.text.primary, fontSize: 14, flex: 1 }} numberOfLines={1}>
                                    {student.name}
                                </Text>
                                {present && (
                                    <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                        {late ? t("Tarde") : methodLabel[method] || method || ""}
                                    </Text>
                                )}
                                {present && canCorrect && (
                                    <View style={{ flexDirection: "row", gap: 6 }}>
                                        {!late && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onPress={() => onCorrect?.(student.academicActorId)}
                                            >
                                                {t("Tarde")}
                                            </Button>
                                        )}
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onPress={() => onRemove?.(student.academicActorId)}
                                        >
                                            {t("Quitar")}
                                        </Button>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </Card>
    );
}

function CapturePanel({ kioskVm }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const permissions = useRolePermissions();
    const canCorrect = permissions.canCorrectAttendance ?? false;
    const [pending, setPending] = useState(null);
    const [busy, setBusy] = useState(false);

    async function runPending() {
        if (!pending) return;
        setBusy(true);
        if (pending.kind === "cancel") {
            // cancelClass devuelve el mensaje de error (no lanza): sin leerlo, un
            // fallo del backend se perdía y el kiosco parecía no responder.
            const err = await kioskVm.cancelClass();
            if (err) kioskVm.onCaptureError(err);
        } else if (pending.kind === "correct") {
            const err = await kioskVm.correctRecord?.(pending.actorId, "Late");
            if (err) kioskVm.onCaptureError(err);
        } else if (pending.kind === "remove") {
            const err = await kioskVm.removeRecord?.(pending.actorId);
            if (err) kioskVm.onCaptureError(err);
        }
        setBusy(false);
        setPending(null);
    }

    // null | "FACE" | "FINGER" — qué captura está corriendo ahora mismo en
    // ESTA pantalla. kioskVm.view nunca distingue esto (ver cabecera del
    // archivo), así que el banner lo deriva combinando ambos más abajo.
    const [activeCapture, setActiveCaptureState] = useState(null);
    // Ajuste "Registro automático" de la sede. Activado: el rostro se reconoce
    // solo, de forma continua, por el WebSocket. Desactivado: cada asistencia
    // se pide pulsando "Reconocer rostro".
    const [autoRegister, setAutoRegister] = useState(() => getInstitutionConfig().autoRegister !== false);
    useEffect(
        () => onInstitutionConfigChange((config) => setAutoRegister(config?.autoRegister !== false)),
        []
    );
    // Espejo síncrono de activeCapture: los efectos/callbacks de abajo lo
    // necesitan leer en el momento exacto en que una promesa se resuelve,
    // sin esperar al siguiente render (el bug de Critical #2 era justamente
    // depender de un closure stale en vez de este tipo de ref).
    const activeCaptureRef = useRef(null);
    // Generación del intento en curso: al presionar "Usa tu huella" se
    // incrementa, invalidando cualquier callback de un loginFace() que
    // siga en vuelo — así un resultado facial que llega tarde (ya
    // reemplazado por una captura de huella) se ignora en vez de pisar el
    // estado o registrar la asistencia de quien ya no es el actual.
    const attemptIdRef = useRef(0);
    const fingerprintArmTimeoutRef = useRef(null);

    const setActiveCapture = useCallback((value) => {
        activeCaptureRef.current = value;
        setActiveCaptureState(value);
    }, []);

    const clearFingerprintArmTimeout = useCallback(() => {
        if (fingerprintArmTimeoutRef.current) {
            clearTimeout(fingerprintArmTimeoutRef.current);
            fingerprintArmTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => clearFingerprintArmTimeout, [clearFingerprintArmTimeout]);

    // vm mínimo que esperan useFaceCapture/useFingerprintReader. No hay
    // persona preseleccionada (no es el flujo de Biometrics), así que
    // requirePersonId/refreshSummary son no-ops; run es pasante porque
    // esta pantalla no tiene su propio estado "busy".
    // Aviso de cámara: el kiosco no tiene barra de estado, así que los errores
    // de useFaceCapture (permiso denegado, sin cámara, en uso) se guardan aquí
    // para pintarlos junto al visor; cualquier estado no-error lo limpia.
    const [cameraMessage, setCameraMessage] = useState("");
    const vm = useMemo(
        () => ({
            run: (op) => op(),
            setStatus: (message, tone) => setCameraMessage(tone === "error" ? message : ""),
            requirePersonId: () => null,
            refreshSummary: () => Promise.resolve(null),
        }),
        []
    );

    const face = useFaceCapture({
        vm,
        socket: kioskVm.socket,
        onIdentified: (data) => {
            // Un botón de huella puede haber reemplazado este intento de
            // rostro mientras seguía en vuelo: ignorar el resultado tardío.
            if (activeCaptureRef.current !== "FACE") return;
            kioskVm.onIdentified(data.person_id, { biometricType: "FACIAL", score: data.score });
        },
    });
    const fingerprint = useFingerprintReader({
        vm,
        socket: kioskVm.socket,
        onIdentified: (data) => {
            if (activeCaptureRef.current !== "FINGER") return;
            kioskVm.onIdentified(data.person_id, { biometricType: "FINGERPRINT", score: data.score });
        },
    });

    // Enciende la cámara una sola vez al entrar al kiosco: es un modo
    // pasivo/desatendido, no tiene sentido pedir al profesor que pulse
    // "dar acceso a la cámara" cada vez que abre una clase.
    useEffect(() => {
        face.startCamera();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Ciclo pasivo: mientras se espera (WAITING) y la cámara ya está lista,
    // intenta reconocer el rostro de quien se acerque, una y otra vez,
    // durante todo el tiempo que la pantalla siga en WAITING — no solo una
    // vez. El efecto se dispara SOLO por kioskVm.view/cameraReady — NUNCA
    // por activeCapture — porque ese era justamente el bug (Critical #2):
    // al depender de activeCapture, el propio setActiveCapture("FACE") de
    // abajo volvía a disparar el efecto, su cleanup marcaba `cancelled` en
    // ese nuevo closure, y cuando el loginFace() del PRIMER intento por fin
    // resolvía, el `.finally` leía esa bandera y nunca volvía a poner
    // activeCapture en null — el kiosco quedaba trabado tras el primer
    // estudiante. Con el bucle vivo dentro de un solo efecto (gateado solo
    // por view/cameraReady) y activeCapture leído/escrito vía ref, el mismo
    // efecto puede lanzar loginFace() tantas veces como haga falta.
    useEffect(() => {
        if (!autoRegister) return;
        if (kioskVm.view !== "WAITING") return;
        if (!face.cameraReady) return;

        let cancelled = false;
        // Intentos fallidos seguidos: sin nadie frente a la cámara cada intento
        // termina en "gesto no detectado", y reintentar cada 200 ms inundaba
        // el servicio de biometría. Se espacian hasta FACE_MAX_BACKOFF_MS y se
        // vuelve al ritmo normal en cuanto un intento sale bien.
        let failedAttempts = 0;

        async function loop() {
            while (!cancelled) {
                // El lector de huella (activado por el botón) tiene
                // prioridad: esperar a que quede libre antes de lanzar
                // otro intento facial, en vez de competir con él.
                if (activeCaptureRef.current !== null) {
                    await wait(FACE_RETRY_WAIT_MS);
                    continue;
                }

                const attemptId = ++attemptIdRef.current;
                setActiveCapture("FACE");
                try {
                    await face.loginFace();
                    failedAttempts = 0;
                } catch (e) {
                    failedAttempts += 1;
                    // `cancelled` también se vuelve true cuando la clase ya
                    // terminó (endClass cambia kioskVm.view a SELECT_SESSION,
                    // lo que dispara el cleanup de este efecto) — un rechazo
                    // tardío de ese momento (p. ej. el socket se cerró a mitad
                    // de este loginFace()) no debe reportarse como un error de
                    // captura: la clase ya no existe.
                    if (!cancelled && attemptIdRef.current === attemptId) kioskVm.onCaptureError(e.message);
                } finally {
                    // Este reset SIEMPRE debe correr si el intento sigue
                    // vigente (attemptId coincide), sin importar `cancelled`:
                    // el bug de Critical #2 era justamente saltarse este
                    // reset cuando el efecto ya se había cancelado (p. ej.
                    // porque este mismo intento tuvo éxito y kioskVm.view
                    // cambió a SUCCESS/DUPLICATE/ERROR antes de que
                    // loginFace() terminara de resolver) — sin él,
                    // activeCaptureRef se quedaba en "FACE" para siempre y
                    // ningún loop futuro volvía a intentarlo.
                    if (attemptIdRef.current === attemptId) setActiveCapture(null);
                }
                if (cancelled) return;
                // Pausa real (no solo de microtareas) entre intentos: sin
                // esto, un loginFace() que resuelve muy rápido (p. ej. en un
                // test con mocks) encadenaría awaits sin ceder nunca al
                // event loop real, acaparándolo por completo.
                await wait(Math.min(FACE_RETRY_WAIT_MS * 2 ** failedAttempts, FACE_MAX_BACKOFF_MS));
            }
        }

        loop();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kioskVm.view, face.cameraReady, autoRegister]);

    // Modo manual (registro automático desactivado): un solo intento por pulsación.
    const handleFaceRecognizePress = async () => {
        if (activeCaptureRef.current !== null || !face.cameraReady) return;
        const attemptId = ++attemptIdRef.current;
        setActiveCapture("FACE");
        try {
            await face.loginFace();
        } catch (e) {
            if (attemptIdRef.current === attemptId) kioskVm.onCaptureError(e.message);
        } finally {
            if (attemptIdRef.current === attemptId) setActiveCapture(null);
        }
    };

    // "Usa tu huella" ARMA el lector (startCapture) y marca
    // activeCapture="FINGER" de inmediato — puede interrumpir un intento de
    // rostro en curso (Important #5): no espera a que loginFace() termine,
    // solo invalida su resultado (ver attemptIdRef arriba). No llama a
    // loginFingerprint() todavía: esa llamada exige una muestra ya
    // capturada (lee stateRef.current.sample vía takeSample(), que lanza
    // "Captura una huella primero." si está vacía) y esa muestra solo
    // existe una vez que el callback onSamplesAcquired del SDK la puso ahí
    // — lo mismo que hace FingerprintModule.js (startCapture → esperar
    // sampleReady → identify). El envío a reconocimiento ocurre solo, en el
    // efecto de abajo, cuando sampleReady pasa a true: el kiosco no tiene
    // teclado/mouse, así que no puede pedir una segunda pulsación para
    // "confirmar" la captura.
    //
    // Timeout de armado: si nadie pone el dedo, no puede quedar el lector
    // armado (y el ciclo de rostro bloqueado) para siempre.
    const handleFingerprintPress = () => {
        attemptIdRef.current += 1; // invalida cualquier loginFace() en vuelo
        setActiveCapture("FINGER");
        fingerprint.startCapture();

        clearFingerprintArmTimeout();
        fingerprintArmTimeoutRef.current = setTimeout(() => {
            fingerprintArmTimeoutRef.current = null;
            if (activeCaptureRef.current !== "FINGER") return;
            if (fingerprint.sampleReady) return; // ya hay muestra; el otro efecto la procesa
            fingerprint.stopCapture?.();
            setActiveCapture(null);
        }, FINGERPRINT_ARM_TIMEOUT_MS);
    };

    // Registro automático: el lector queda armado mientras se espera a alguien (sin
    // pulsar "Usa tu huella") y la muestra se identifica por el mismo WebSocket que
    // el rostro. Sin registro automático solo se arma con el botón.
    useEffect(() => {
        if (!autoRegister || kioskVm.view !== "WAITING") return;
        if (!fingerprint.deviceReady || fingerprint.capturing || fingerprint.sampleReady) return;
        if (activeCaptureRef.current === "FINGER") return;
        fingerprint.startCapture();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRegister, kioskVm.view, fingerprint.deviceReady, fingerprint.capturing, fingerprint.sampleReady, activeCapture]);

    // Llegó una muestra sin pulsar nada (modo automático): toma el turno al rostro.
    useEffect(() => {
        if (!autoRegister || kioskVm.view !== "WAITING" || !fingerprint.sampleReady) return;
        if (activeCaptureRef.current === "FINGER") return;
        attemptIdRef.current += 1; // invalida cualquier loginFace() en vuelo
        setActiveCapture("FINGER");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRegister, kioskVm.view, fingerprint.sampleReady]);

    useEffect(() => {
        if (activeCapture !== "FINGER") return;
        if (!fingerprint.sampleReady) return;

        clearFingerprintArmTimeout();
        fingerprint
            .loginFingerprint()
            .catch((e) => {
                if (activeCaptureRef.current === "FINGER") kioskVm.onCaptureError(e.message);
                // Sin esto la muestra fallida seguiría "lista" y se reintentaría sola.
                fingerprint.discardSample?.();
            })
            .finally(() => {
                if (activeCaptureRef.current === "FINGER") setActiveCapture(null);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCapture, fingerprint.sampleReady]);

    // El viewmodel central solo conoce SELECT_SESSION/WAITING/SUCCESS/
    // DUPLICATE/ERROR. CAPTURING_FACE/CAPTURING_FINGER son una derivación
    // puramente local: solo tienen sentido mientras el viewmodel sigue en
    // WAITING y esta pantalla sabe que ya lanzó una captura.
    const displayState =
        activeCapture === "FACE" && kioskVm.view === "WAITING"
            ? "CAPTURING_FACE"
            : activeCapture === "FINGER" && kioskVm.view === "WAITING"
              ? "CAPTURING_FINGER"
              : kioskVm.view;

    const messages = {
        WAITING: {
            icon: "user",
            tone: "default",
            title: autoRegister ? t("Acércate al lector") : t("Pulsa «Reconocer rostro»"),
        },
        CAPTURING_FACE: { icon: "camera", tone: "primary", title: t("Verificando rostro...") },
        CAPTURING_FINGER: { icon: "target", tone: "primary", title: t("Verificando huella...") },
        SUCCESS: { icon: "check-circle", tone: "success", title: t("Asistencia registrada") },
        DUPLICATE: { icon: "repeat", tone: "warning", title: t("Ya registrado") },
        ERROR: { icon: "x-circle", tone: "danger", title: t("No se pudo verificar") },
    };
    const banner = messages[displayState] || messages.WAITING;
    const bannerColor = toneColor(c, banner.tone);

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={t("Kiosco de asistencia")}
                subtitle={t("Cada estudiante se acerca y se identifica por rostro o huella")}
            />
            {kioskVm.connectionStatus === "reconnecting" && (
                <View
                    style={{
                        backgroundColor: c.status.warningLight || c.status.warning,
                        paddingVertical: 8,
                        alignItems: "center",
                    }}
                >
                    <Text style={{ color: c.text.primary, fontSize: 13, fontWeight: "700" }}>
                        {t("Reconectando…")}
                    </Text>
                </View>
            )}
            <ScrollView
                contentContainerStyle={{ padding: 24, gap: 20, alignItems: "center", flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={{
                        width: "100%",
                        maxWidth: 900,
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 20,
                        justifyContent: "center",
                        alignItems: "flex-start",
                    }}
                >
                <View style={{ width: "100%", maxWidth: 560, gap: 20, alignItems: "center" }}>
                    <Card
                        padding="lg"
                        style={{ width: "100%" }}
                        contentStyle={{ alignItems: "center", gap: 16, paddingVertical: 48 }}
                    >
                        <View
                            style={{
                                width: 96,
                                height: 96,
                                borderRadius: 48,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: `${bannerColor}22`,
                            }}
                        >
                            <Feather name={banner.icon} size={48} color={bannerColor} />
                        </View>
                        <Text style={{ color: c.text.primary, fontSize: 24, fontWeight: "700", textAlign: "center" }}>
                            {banner.title}
                        </Text>
                        {(displayState === "SUCCESS" || displayState === "DUPLICATE") && !!kioskVm.lastRegistration && (
                            <RegistrationAlert registration={kioskVm.lastRegistration} t={t} c={c} />
                        )}
                        {displayState === "ERROR" && !!kioskVm.statusMessage && (
                            <Text style={{ color: c.text.secondary, fontSize: 14, textAlign: "center" }}>
                                {kioskVm.statusMessage}
                            </Text>
                        )}

                        {CAMERA_SUPPORTED && Platform.OS === "web" ? (
                            <View
                                style={{
                                    width: "100%",
                                    maxWidth: 320,
                                    aspectRatio: 4 / 3,
                                    borderRadius: 12,
                                    overflow: "hidden",
                                    backgroundColor: "#000",
                                }}
                            >
                                {/* Elemento DOM real: sin esto, face.startCamera() nunca
                                    encuentra un videoRef.current y la cámara no arranca
                                    (Critical #1). Espejado horizontal, como el resto de
                                    los visores de cámara de la app. */}
                                <video
                                    ref={face.videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        transform: "scaleX(-1)",
                                    }}
                                />
                            </View>
                        ) : (
                            <Text style={{ color: c.text.secondary, fontSize: 13, textAlign: "center" }}>
                                {t("Cámara no disponible: usa tu huella")}
                            </Text>
                        )}

                        {!!cameraMessage && (
                            <View style={{ alignItems: "center", gap: 8 }}>
                                <Text
                                    accessibilityRole="alert"
                                    style={{ color: c.status.danger, fontSize: 13, textAlign: "center" }}
                                >
                                    {cameraMessage}
                                </Text>
                                {!face.cameraReady && (
                                    <Button variant="outline" size="sm" onPress={face.startCamera}>
                                        {t("Reintentar cámara")}
                                    </Button>
                                )}
                            </View>
                        )}

                        {!!face.livenessAction && (
                            <Text
                                accessibilityRole="alert"
                                style={{ color: c.brand.primary, fontSize: 16, fontWeight: "700", textAlign: "center" }}
                            >
                                {face.livenessAction}
                            </Text>
                        )}

                        <Text style={{ color: c.text.secondary, fontSize: 13 }}>
                            {t("Registrados")}: {kioskVm.registeredActorIds.size}
                        </Text>
                    </Card>

                    <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
                        {!autoRegister && (
                            <Button
                                variant="primary"
                                style={{ flex: 1 }}
                                disabled={activeCapture !== null || !face.cameraReady || kioskVm.view !== "WAITING"}
                                leftIcon={<Feather name="camera" size={16} color={c.brand.textOnPrimary} />}
                                onPress={handleFaceRecognizePress}
                            >
                                {t("Reconocer rostro")}
                            </Button>
                        )}
                        {!autoRegister && fingerprint.deviceReady && (
                            <Button
                                variant="outline"
                                style={{ flex: 1 }}
                                disabled={activeCapture === "FINGER"}
                                leftIcon={<Feather name="target" size={16} color={c.brand.primary} />}
                                onPress={handleFingerprintPress}
                            >
                                {t("Usa tu huella")}
                            </Button>
                        )}
                        <Button
                            variant="danger"
                            style={{ flex: 1 }}
                            leftIcon={<Feather name="stop-circle" size={16} color={c.brand.textOnPrimary} />}
                            onPress={() => {
                                // endClass() es async (cierra la sesión vía API); sin este
                                // .catch, un rechazo quedaría como unhandled rejection y la
                                // pantalla se quedaría atascada sin ninguna señal visible.
                                kioskVm.endClass().catch((e) => kioskVm.onCaptureError(e.message));
                            }}
                        >
                            {t("Finalizar clase")}
                        </Button>
                        {permissions.canManageSessions && (
                            <Button
                                variant="outline"
                                style={{ flex: 1 }}
                                leftIcon={<Feather name="x-circle" size={16} color={c.status.danger} />}
                                onPress={() => setPending({ kind: "cancel" })}
                            >
                                {t("Cancelar clase")}
                            </Button>
                        )}
                    </View>
                </View>

                <RosterPanel
                    kioskVm={kioskVm}
                    canCorrect={canCorrect}
                    onCorrect={(actorId) => setPending({ kind: "correct", actorId })}
                    onRemove={(actorId) => setPending({ kind: "remove", actorId })}
                />
                {pending != null && (
                    <ConfirmModal
                        visible
                        onClose={() => (busy ? null : setPending(null))}
                        onConfirm={runPending}
                        loading={busy}
                        variant="danger"
                        title={
                            pending?.kind === "cancel"
                                ? t("Cancelar clase")
                                : pending?.kind === "correct"
                                  ? t("Marcar tarde")
                                  : t("Quitar registro")
                        }
                        message={
                            pending?.kind === "cancel"
                                ? t("La sesión pasará a Cancelled y no se podrá reabrir. ¿Continuar?")
                                : pending?.kind === "correct"
                                  ? t("El registro pasará a Tarde (captura MANUAL). ¿Continuar?")
                                  : t("Se eliminará el registro de asistencia. ¿Continuar?")
                        }
                        confirmText={t("Confirmar")}
                    />
                )}
                </View>
            </ScrollView>
        </View>
    );
}

// Aviso de quién quedó registrado y con qué método, junto al estado de la clase.
function RegistrationAlert({ registration, t, c }) {
    const methodLabel = registration.method === "FINGERPRINT" ? t("Huella") : t("Rostro");
    const late = registration.status === "Late";
    return (
        <View accessibilityRole="alert" style={{ alignItems: "center", gap: 8 }}>
            {!!registration.name && (
                <Text style={{ color: c.text.primary, fontSize: 22, fontWeight: "700", textAlign: "center" }}>
                    {registration.name}
                </Text>
            )}
            <Text style={{ color: c.text.secondary, fontSize: 14 }}>
                {registration.duplicate
                    ? `${t("Ya estaba registrado mediante")}: ${methodLabel}`
                    : `${t("Registrado mediante")}: ${methodLabel}`}
            </Text>
            {late && (
                <View
                    style={{
                        backgroundColor: c.status.warningLight || c.status.warning,
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                    }}
                >
                    <Text style={{ color: c.status.warningDark || c.text.primary, fontSize: 13, fontWeight: "700" }}>
                        {t("Llegada tarde")}
                    </Text>
                </View>
            )}
        </View>
    );
}

export default function AttendanceKioskView() {
    const kioskVm = useAttendanceKioskViewModel();

    if (kioskVm.view === "SELECT_SESSION") {
        return <SelectSessionPanel kioskVm={kioskVm} />;
    }

    return <CapturePanel kioskVm={kioskVm} />;
}
