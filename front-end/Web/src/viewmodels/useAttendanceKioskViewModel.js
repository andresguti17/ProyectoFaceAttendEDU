// ============================================================
//  FaceAttend EDU — useAttendanceKioskViewModel
//
//  Viewmodel para la pantalla de toma de asistencia ("kiosco").
//  Parte A: ciclo de vida de la sesión de clase.
//    - todaysBlocks: bloques horarios del instructor para hoy.
//    - startClass(block): resuelve-o-crea la sesión de hoy y la abre.
//    - endClass(): cierra la sesión activa.
//  Parte B: captura biométrica/dedup/registro de asistencia sobre esa
//  misma sesión.
//    - socket: canal biométrico abierto mientras hay una sesión activa.
//    - connectionStatus: "connecting"|"open"|"reconnecting"|"closed" del
//      socket, para que la vista muestre un banner no bloqueante.
//    - onIdentified(personId, {biometricType, score}): resuelve la
//      persona a academicActorId vía el cohorte, aplica dedup local y
//      crea el attendance_record.
//    - onCaptureError(message): estado terminal ERROR para un fallo de
//      captura (p. ej. sin match).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { attendanceApi } from "../services/api/attendanceApi";
import { cohortActorByPerson, cohortRoster, listBlocks } from "../services/api/referenceData";
import { schedulingApi } from "../services/api/schedulingApi";
import { connectBiometricSocket } from "../services/ws/biometricSocket";
import { loadClassCards } from "./classCards";

/** getDay(): 0=domingo..6=sábado -> ISO 1..7 del DBML (1=lunes..7=domingo). */
export function isoWeekday(date = new Date()) {
    return ((date.getDay() + 6) % 7) + 1;
}

/** Fecha local YYYY-MM-DD. `toISOString()` da la fecha en UTC, que en
 * UTC-5 (Colombia) ya es "mañana" desde las 7pm hora local — una clase
 * nocturna que recarga la pantalla después de esa hora buscaría la
 * sesión de hoy con una fecha distinta a la que usó isoWeekday() (que sí
 * es local), creando una segunda sesión duplicada para el mismo bloque. */
export function todayLocalDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// Cuánto se queda la pantalla en SUCCESS/DUPLICATE/ERROR antes de volver
// a WAITING para la siguiente captura.
const TERMINAL_VIEW_RESET_MS = 2000;

export function useAttendanceKioskViewModel() {
    const { user } = useAuth();

    const [view, setView] = useState("SELECT_SESSION");
    const [blocks, setBlocks] = useState([]);
    const [session, setSession] = useState(null);
    const [block, setBlock] = useState(null);
    const [statusMessage, setStatusMessage] = useState("");
    const [socket, setSocket] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState("closed");
    const [registeredActorIds, setRegisteredActorIds] = useState(new Set());
    // academicActorId -> "FACIAL"|"FINGERPRINT" (el modo con el que registró
    // asistencia), para el panel de lista de estudiantes del kiosco. Nunca
    // "IOT": ese es solo el valor que viaja al backend (ver onIdentified),
    // aquí se guarda el modo real para mostrarlo al profesor.
    const [registeredMethods, setRegisteredMethods] = useState(new Map());
    // Roster del cohorte de la clase activa: [{academicActorId, personId,
    // name}], para el panel de lista de estudiantes junto a la cámara.
    const [roster, setRoster] = useState([]);
    // academicActorId que ya están marcados como Tarde (corrección del profesor).
    const [lateActorIds, setLateActorIds] = useState(new Set());

    // Refs: leídos por onIdentified/el listener del socket, que deben ver
    // siempre el valor más reciente sin forzar su propia recreación.
    const socketRef = useRef(null);
    const actorByPersonRef = useRef(new Map());
    const registeredActorIdsRef = useRef(new Set());
    const registeredMethodsRef = useRef(new Map());
    // academicActorId -> attendance_record_id, para corregir/eliminar el
    // registro desde el kiosco (canCorrectAttendance, HU-ATT-003).
    const recordIdByActorRef = useRef(new Map());
    const [recordIdByActor, setRecordIdByActor] = useState(new Map());
    const unsubscribeAttendanceRef = useRef(null);
    const unsubscribeStatusRef = useRef(null);
    const resetTimerRef = useRef(null);
    // Espejo síncrono de `session`, leído por onCaptureError: una captura en
    // vuelo puede rechazar justo después de que endClass() ya puso session en
    // null (p. ej. el socket se cerró a mitad de un loginFace()/loginFingerprint()).
    // Sin este guard, ese error tardío volvía a poner view en "ERROR" encima de
    // "SELECT_SESSION" con session/socket ya en null — el siguiente intento de
    // "Finalizar clase" fallaba porque session era null.
    const sessionRef = useRef(null);
    // Evita que un doble click (o un reintento tras un fallo) en "Iniciar
    // clase" dispare dos startClass() en paralelo: el segundo abriría un
    // socket nuevo que pisaría la ref del primero sin cerrarlo nunca.
    const startingRef = useRef(false);

    useEffect(() => {
        listBlocks()
            .then(setBlocks)
            .catch(() => setStatusMessage("No se pudieron cargar los bloques de horario"));
    }, []);

    // Al desmontar sin pasar por endClass (navegación, cierre de pestaña):
    // no dejar el socket ni el timer de reset vivos.
    useEffect(() => {
        return () => {
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
            if (unsubscribeAttendanceRef.current) unsubscribeAttendanceRef.current();
            if (unsubscribeStatusRef.current) unsubscribeStatusRef.current();
            if (socketRef.current) socketRef.current.close();
        };
    }, []);

    const todaysBlocks = useMemo(
        () =>
            blocks.filter(
                (b) => b.instructorActorId === user?.academicActorId && b.dayOfWeek === isoWeekday()
            ),
        [blocks, user?.academicActorId]
    );

    // Detalles de las tarjetas de clase (curso, ficha, ambiente, matriculados y
    // estado de la sesión de hoy). Se refrescan cada vez que se vuelve a la lista,
    // p. ej. tras finalizar una clase, para que la tarjeta pase a "Cerrada".
    const [classCards, setClassCards] = useState(new Map());
    const [classCardsLoading, setClassCardsLoading] = useState(true);
    useEffect(() => {
        if (view !== "SELECT_SESSION" || todaysBlocks.length === 0) return undefined;
        let cancelled = false;
        setClassCardsLoading(true);
        loadClassCards(todaysBlocks, todayLocalDate()).then((details) => {
            if (cancelled) return;
            setClassCards(details);
            setClassCardsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [view, todaysBlocks]);

    function syncRegisteredActorIds() {
        setRegisteredActorIds(new Set(registeredActorIdsRef.current));
    }

    function syncRegisteredMethods() {
        setRegisteredMethods(new Map(registeredMethodsRef.current));
    }

    // Otro kiosco en la misma sesión ya registró a este actor: reflejarlo
    // localmente sin round-trip propio a attendanceApi. El frame es plano
    // (sin wrapper payload) y usa snake_case, p. ej.
    // { type: "attendance.event", person_id, biometric_type, score, ... } —
    // ws_router.py del ms-biometric nunca manda un academic_actor_id, así
    // que siempre hay que resolverlo vía actorByPerson.
    function handleAttendanceEvent(frame) {
        const personId = frame?.person_id;
        if (personId == null) return;
        const academicActorId = actorByPersonRef.current.get(personId);
        if (academicActorId == null) return;
        registeredActorIdsRef.current.add(academicActorId);
        syncRegisteredActorIds();
        if (frame?.biometric_type) {
            registeredMethodsRef.current.set(academicActorId, frame.biometric_type);
            syncRegisteredMethods();
        }
    }

    function scheduleReturnToWaiting() {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
            resetTimerRef.current = null;
            setView("WAITING");
        }, TERMINAL_VIEW_RESET_MS);
    }

    // Cierra (si existe) el socket recién abierto en este intento de
    // startClass y limpia sus suscripciones — usado solo cuando startClass
    // falla a mitad de camino, para no dejarlo huérfano (nadie más tiene
    // su referencia todavía si socketRef/setSocket no llegaron a correr).
    function closeAbandonedSocket(abandonedSocket) {
        if (!abandonedSocket) return;
        abandonedSocket.close();
        if (socketRef.current === abandonedSocket) {
            socketRef.current = null;
            setSocket(null);
        }
        if (unsubscribeAttendanceRef.current) {
            unsubscribeAttendanceRef.current();
            unsubscribeAttendanceRef.current = null;
        }
        if (unsubscribeStatusRef.current) {
            unsubscribeStatusRef.current();
            unsubscribeStatusRef.current = null;
        }
        setConnectionStatus("closed");
    }

    const startClass = useCallback(
        async (nextBlock) => {
            if (startingRef.current) return; // startClass ya en curso: no-op.
            startingRef.current = true;
            let openedSocket = null;

            try {
                const today = todayLocalDate();
                const sessions = await schedulingApi.listSessions();
                let nextSession = sessions.find(
                    (s) => s.scheduleBlockId === nextBlock.scheduleBlockId && s.sessionDate === today
                );

                if (!nextSession) {
                    // La sesión nace ya "Open" (no hay estado "Creada" en el
                    // enum), así que este es el único momento en que el POST
                    // /open que sigue no va a chocar con "already Open": sin
                    // openedBy aquí, quién abrió la clase nunca quedaba
                    // registrado.
                    nextSession = await schedulingApi.createSession({
                        scheduleBlockId: nextBlock.scheduleBlockId,
                        sessionDate: today,
                        openedBy: user?.academicActorId,
                    });
                }

                try {
                    // Una sesión recién creada, o una ya abierta, no necesita /open:
                    // pedirlo devuelve un 400 "already Open" que solo ensucia la consola.
                    if (nextSession.sessionStatus !== "Open") {
                        nextSession = await schedulingApi.openSession(nextSession.classSessionId, user?.academicActorId);
                    }
                } catch (e) {
                    if (e?.status !== 400) throw e;
                    // El 400 de "ya estaba Open" y el de "no se puede abrir una
                    // sesión Closed/Cancelled" llegan con el MISMO status, solo
                    // el mensaje cambia — hay que comprobar el estado real antes
                    // de seguir, o un reclick sobre una sesión ya cerrada
                    // empezaría a grabar asistencia en una sesión muerta.
                    const refreshed = await schedulingApi.listSessions();
                    const current = refreshed.find((s) => s.classSessionId === nextSession.classSessionId);
                    if (!current || current.sessionStatus !== "Open") {
                        throw new Error("Esta clase ya no está abierta; no se puede tomar asistencia.");
                    }
                    nextSession = current;
                }

                // Canal biométrico + estado local de dedup para esta sesión.
                const nextSocket = connectBiometricSocket({});
                openedSocket = nextSocket;
                socketRef.current = nextSocket;
                setSocket(nextSocket);
                unsubscribeAttendanceRef.current = nextSocket.onAttendanceEvent(handleAttendanceEvent);
                unsubscribeStatusRef.current = nextSocket.onStatusChange(setConnectionStatus);

                const [records, actorByPerson, nextRoster] = await Promise.all([
                    attendanceApi.recordsBySession(nextSession.classSessionId),
                    cohortActorByPerson(nextBlock.cohortId),
                    cohortRoster(nextBlock.cohortId),
                ]);
                actorByPersonRef.current = actorByPerson;
                registeredActorIdsRef.current = new Set(
                    records.map((r) => r.academicActorId ?? r.academic_actor_id)
                );
                setRegisteredActorIds(new Set(registeredActorIdsRef.current));
                recordIdByActorRef.current = new Map(
                    records
                        .filter((r) => (r.academicActorId ?? r.academic_actor_id) != null)
                        .map((r) => [
                            r.academicActorId ?? r.academic_actor_id,
                            r.attendanceRecordId ?? r.attendance_record_id ?? r.id ?? null,
                        ])
                );
                setRecordIdByActor(new Map(recordIdByActorRef.current));
                // "IOT" es el valor que el kiosco manda al backend para huella
                // (ver onIdentified) — al releer un registro existente, se
                // muestra de vuelta como "FINGERPRINT" para el profesor.
                registeredMethodsRef.current = new Map(
                    records.map((r) => [r.academicActorId, r.captureMethod === "IOT" ? "FINGERPRINT" : r.captureMethod])
                );
                setRegisteredMethods(new Map(registeredMethodsRef.current));
                setRoster(nextRoster);
                setLateActorIds(
                    new Set(
                        records
                            .filter((r) => (r.attendanceStatus ?? r.attendance_status) === "Late")
                            .map((r) => r.academicActorId ?? r.academic_actor_id)
                    )
                );

                setStatusMessage("");
                sessionRef.current = nextSession;
                setSession(nextSession);
                setBlock(nextBlock);
                setView("WAITING");
            } catch (e) {
                closeAbandonedSocket(openedSocket);
                setStatusMessage(e?.message || "No se pudo iniciar la clase");
            } finally {
                startingRef.current = false;
            }
        },
        [user]
    );

    // Cierra el canal biométrico de la sesión activa (socket, suscripciones y
    // timer de reset). Lo comparten endClass y cancelClass: ambas terminan la clase.
    function teardownChannel() {
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }
        if (unsubscribeAttendanceRef.current) {
            unsubscribeAttendanceRef.current();
            unsubscribeAttendanceRef.current = null;
        }
        if (unsubscribeStatusRef.current) {
            unsubscribeStatusRef.current();
            unsubscribeStatusRef.current = null;
        }
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
        setSocket(null);
        setConnectionStatus("closed");
    }

    const endClass = useCallback(async () => {
        // Primero se confirma el cierre en el backend: si falla, la clase sigue
        // abierta y el canal vivo, y el profesor puede reintentar sin perder el kiosco.
        await schedulingApi.closeSession(session.classSessionId, user?.academicActorId);
        teardownChannel();

        actorByPersonRef.current = new Map();
        registeredActorIdsRef.current = new Set();
        setRegisteredActorIds(new Set());
        registeredMethodsRef.current = new Map();
        setRegisteredMethods(new Map());
        recordIdByActorRef.current = new Map();
        setRecordIdByActor(new Map());
        setRoster([]);
        setLateActorIds(new Set());
        sessionRef.current = null;
        setSession(null);
        setBlock(null);
        setView("SELECT_SESSION");
    }, [session, user]);

    const onIdentified = useCallback(
        async (personId, { biometricType, score }) => {
            // Lee sessionRef, no el `session` cerrado en este closure: un
            // identify que estaba en vuelo cuando la clase ya terminó
            // (endClass puso sessionRef en null) no debe registrar nada ni
            // revivir ningún banner — igual que onCaptureError arriba.
            const currentSession = sessionRef.current;
            if (!currentSession) return;

            const academicActorId = actorByPersonRef.current.get(personId);
            if (academicActorId == null) {
                setStatusMessage("No pertenece a esta clase");
                setView("ERROR");
                scheduleReturnToWaiting();
                return;
            }

            if (registeredActorIdsRef.current.has(academicActorId)) {
                setStatusMessage("");
                setView("DUPLICATE");
                scheduleReturnToWaiting();
                return;
            }

            try {
                await attendanceApi.createRecord({
                    classSessionId: currentSession.classSessionId,
                    academicActorId,
                    attendanceStatus: "Present",
                    // 05-ms-attendance's AttendanceRecord.ALLOWED_METHOD solo
                    // admite FACIAL/MANUAL/IOT/IMPORT — nunca FINGERPRINT.
                    // Decisión de producto (ver ledger): un identify por huella
                    // se manda como "IOT" (lector USB biométrico), nunca
                    // "MANUAL" (implicaría que un humano lo tecleó).
                    captureMethod: biometricType === "FINGERPRINT" ? "IOT" : biometricType,
                    // El score de huella es un conteo crudo de keypoints SIFT
                    // (puede ser >1), no una similitud coseno 0..1 como el
                    // facial — enviarlo violaría el CHECK/DECIMAL(5,4) de
                    // match_score. Solo el score facial (ya 0..1) se envía.
                    matchScore: biometricType === "FINGERPRINT" ? null : score,
                });
                registeredActorIdsRef.current.add(academicActorId);
                syncRegisteredActorIds();
                registeredMethodsRef.current.set(academicActorId, biometricType);
                syncRegisteredMethods();
                setStatusMessage("");
                setView("SUCCESS");
            } catch (e) {
                if (e?.status === 409) {
                    // Otro kiosco ganó la carrera: mismo resultado que un duplicado local.
                    registeredActorIdsRef.current.add(academicActorId);
                    syncRegisteredActorIds();
                    registeredMethodsRef.current.set(academicActorId, biometricType);
                    syncRegisteredMethods();
                    setStatusMessage("");
                    setView("DUPLICATE");
                } else {
                    setStatusMessage(e?.message || "No se pudo registrar la asistencia");
                    setView("ERROR");
                }
            }

            scheduleReturnToWaiting();
        },
        []
    );

    const onCaptureError = useCallback((message) => {
        // Una captura que estaba en vuelo cuando la clase ya terminó (endClass
        // puso session en null) no debe revivir el banner ERROR encima de
        // SELECT_SESSION — ver sessionRef arriba.
        if (!sessionRef.current) return;
        setStatusMessage(message);
        setView("ERROR");
        scheduleReturnToWaiting();
    }, []);

    function resetKioskState() {
        actorByPersonRef.current = new Map();
        registeredActorIdsRef.current = new Set();
        setRegisteredActorIds(new Set());
        registeredMethodsRef.current = new Map();
        setRegisteredMethods(new Map());
        recordIdByActorRef.current = new Map();
        setRecordIdByActor(new Map());
        setRoster([]);
        setLateActorIds(new Set());
        sessionRef.current = null;
        setSession(null);
        setBlock(null);
        setView("SELECT_SESSION");
    }

    // Cancelar sesión (Open -> Cancelled, AGENTS.md §6 regla 8).
    const cancelClass = useCallback(async () => {
        if (!session?.classSessionId) return "No hay sesión activa";
        try {
            await schedulingApi.cancelSession(session.classSessionId);
        } catch (e) {
            return e?.message || "No se pudo cancelar la sesión";
        }
        teardownChannel();
        resetKioskState();
        return null;
    }, [session]);

    // Corregir estado del registro (Present/Absent/Late/Justified).
    const correctRecord = useCallback(
        async (academicActorId, attendanceStatus) => {
            const recordId = recordIdByActorRef.current.get(academicActorId);
            if (recordId == null) return "Sin registro para corregir";
            try {
                await attendanceApi.updateRecord(recordId, {
                    attendanceStatus,
                    captureMethod: "MANUAL",
                });
            } catch (e) {
                return e?.message || "No se pudo corregir el registro";
            }
            setLateActorIds((prev) => {
                const next = new Set(prev);
                if (attendanceStatus === "Late") next.add(academicActorId);
                else next.delete(academicActorId);
                return next;
            });
            return null;
        },
        []
    );

    // Eliminar registro del kiosco (dentro de sesión abierta).
    const removeRecord = useCallback(async (academicActorId) => {
        const recordId = recordIdByActorRef.current.get(academicActorId);
        if (recordId == null) return "Sin registro para eliminar";
        try {
            await attendanceApi.deleteRecord(recordId);
        } catch (e) {
            return e?.message || "No se pudo eliminar el registro";
        }
        recordIdByActorRef.current.delete(academicActorId);
        setRecordIdByActor(new Map(recordIdByActorRef.current));
        registeredActorIdsRef.current.delete(academicActorId);
        setRegisteredActorIds(new Set(registeredActorIdsRef.current));
        registeredMethodsRef.current.delete(academicActorId);
        setRegisteredMethods(new Map(registeredMethodsRef.current));
        setLateActorIds((prev) => {
            const next = new Set(prev);
            next.delete(academicActorId);
            return next;
        });
        return null;
    }, []);

    return {
        view,
        todaysBlocks,
        classCards,
        classCardsLoading,
        startClass,
        endClass,
        cancelClass,
        correctRecord,
        removeRecord,
        recordIdByActor,
        session,
        statusMessage,
        socket,
        connectionStatus,
        registeredActorIds,
        registeredMethods,
        roster,
        lateActorIds,
        onIdentified,
        onCaptureError,
    };
}
