// ============================================================
//  FaceAttend EDU — Justifications ViewModel
// ============================================================
//  RESPONSABILIDAD: Lógica de justificaciones de asistencia
//
//  Alumno (HU-JUS-001): lista sus justificaciones y registra una
//  nueva sobre una inasistencia/tardanza elegible, con soporte.
//  Instructor/Admin (HU-JUS-002): revisa las pendientes de su
//  alcance y aprueba o rechaza con observaciones.
//
//  El backend implementa PATCH /justifications/{id}/review con
//  reviewStatus Pending/Approved/Rejected: los endpoints propuestos
//  por la HU (POST .../approve y .../reject) no existen.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useRolePermissions } from "./useRolePermissions";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { batched } from "../core/utils/batching";
import { attendanceApi, schedulingApi } from "../services/api";
import { notifyJustificationResult } from "../services/api/justificationNotifications";
import { actorMap, listBlocks, optional, personMap } from "../services/api/referenceData";

// Formatos y tamaño máximo propuestos por HU-JUS-001 (PDF, JPG, JPEG, PNG · 5 MB).
export const ALLOWED_DOC_TYPES = ["pdf", "jpg", "jpeg", "png"];
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

// Cada getRecord recorre la tabla entera en el backend: acotar la carga.
const MAX_ENRICHED_ITEMS = 100;
// Máximo de alumnos cuyos registros se piden para acotar el cruce del revisor
// (mismo tope que el historial): sin él, un docente con muchas fichas dispararía
// cientos de peticiones.
const MAX_SCOPE_ACTORS = 50;

export const REVIEW_STATUS_LABELS = {
    Pending: "Pendiente",
    Approved: "Aprobada",
    Rejected: "Rechazada",
};

const EMPTY_LOOKUPS = { sessions: [], blocks: [], environments: [], actors: null, persons: null };

function dateOf(instant) {
    if (!instant) return "";
    return String(instant).slice(0, 10);
}

export function useJustificationsViewModel() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const appData = useAppData();
    const permissions = useRolePermissions();

    const isReviewer = permissions.canReviewJustifications;
    const mode = isReviewer ? "review" : "submit";

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [types, setTypes] = useState([]);
    const [lookups, setLookups] = useState(EMPTY_LOOKUPS);
    const [records, setRecords] = useState([]);
    const [justifications, setJustifications] = useState([]);

    // Alumno: selector de lista y modal de envío.
    const [listTab, setListTab] = useState("mine");
    const [submitOpen, setSubmitOpen] = useState(false);
    const [submitTarget, setSubmitTarget] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Revisor: filtro, detalle y decisión.
    const [reviewTab, setReviewTab] = useState("pending");
    const [detail, setDetail] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [decision, setDecision] = useState(null);
    const [notes, setNotes] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isReviewing, setIsReviewing] = useState(false);

    // ── Alcance del revisor (HU-JUS-002 AC1) ────────────────
    const reviewerActorIds = useMemo(() => {
        if (!isReviewer || !user) return null;
        if (user.role === "admin") return null; // sede completa
        const myCourseIds = (appData.courses || [])
            .filter(
                (c) =>
                    Array.isArray(c.instructorActorIds) &&
                    c.instructorActorIds.includes(user.academicActorId)
            )
            .map((c) => c.id);
        return new Set(
            (appData.students || [])
                .filter((s) => Array.isArray(s.courseIds) && s.courseIds.some((id) => myCourseIds.includes(id)))
                .map((s) => Number(s.id))
        );
    }, [isReviewer, user, appData.courses, appData.students]);

    const personNameOf = useCallback(
        (actorId) => {
            const actor = lookups.actors instanceof Map ? lookups.actors.get(Number(actorId)) : null;
            const person = actor && lookups.persons instanceof Map ? lookups.persons.get(actor.personId) : null;
            if (!person) return actor?.actorCode || "";
            return `${person.name ?? ""} ${person.lastName ?? ""}`.trim();
        },
        [lookups]
    );

    // ── Carga ────────────────────────────────────────────────
    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [typeList, justificationList, sessions, blocks, environments, actors, persons] =
                await Promise.all([
                    optional(attendanceApi.listJustificationTypes(), []),
                    optional(attendanceApi.listJustifications(), []),
                    optional(schedulingApi.listSessions(), []),
                    optional(listBlocks(), []),
                    optional(schedulingApi.listEnvironments(), []),
                    optional(actorMap(), null),
                    optional(personMap(), null),
                ]);

            let myRecords = [];
            if (!isReviewer && user?.academicActorId) {
                myRecords = await attendanceApi
                    .recordsByActor(Number(user.academicActorId))
                    .catch(() => []);
            }

            setTypes((typeList || []).filter((x) => x.status !== false));
            setJustifications(justificationList || []);
            setRecords(myRecords);
            setLookups({ sessions, blocks, environments, actors, persons });
        } catch (e) {
            setError(e?.message || t("No se pudieron cargar las justificaciones."));
        } finally {
            setIsLoading(false);
        }
    }, [isReviewer, user, t]);

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Datos derivados: alumno ──────────────────────────────
    const recordMap = useMemo(
        () => new Map(records.map((r) => [Number(r.attendanceRecordId), r])),
        [records]
    );

    const sessionDate = useCallback(
        (record) => {
            if (!record) return "";
            const session = lookups.sessions.find(
                (s) => Number(s.classSessionId) === Number(record.classSessionId)
            );
            return session?.sessionDate || dateOf(record.capturedAt) || "";
        },
        [lookups.sessions]
    );

    const myJustifications = useMemo(() => {
        if (isReviewer) return [];
        return justifications
            .filter((j) => recordMap.has(Number(j.attendanceRecordId)))
            .map((j) => {
                const record = recordMap.get(Number(j.attendanceRecordId));
                return { ...j, record, date: sessionDate(record), recordStatus: record?.attendanceStatus };
            })
            .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
    }, [isReviewer, justifications, recordMap, sessionDate]);

    const justifiedRecordIds = useMemo(
        () => new Set(justifications.map((j) => Number(j.attendanceRecordId))),
        [justifications]
    );

    // AC1: inasistencias y tardanzas aún sin justificar.
    const eligibleRecords = useMemo(() => {
        if (isReviewer) return [];
        return records
            .filter(
                (r) =>
                    (r.attendanceStatus === "Absent" || r.attendanceStatus === "Late") &&
                    !justifiedRecordIds.has(Number(r.attendanceRecordId))
            )
            .map((r) => ({ ...r, date: sessionDate(r) }))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }, [isReviewer, records, justifiedRecordIds, sessionDate]);

    // ── Datos derivados: revisor ─────────────────────────────
    // Admin (alcance = sede completa): sin el registro de cada justificación no
    // se puede saber a quién pertenece, así que se acota a los más recientes.
    // El instructor sí conoce su alcance y cruza contra TODAS las justificaciones.
    const reviewItems = useMemo(
        () =>
            isReviewer && reviewerActorIds == null
                ? [...justifications]
                      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
                      .slice(0, MAX_ENRICHED_ITEMS)
                : [],
        [isReviewer, reviewerActorIds, justifications]
    );

    // AC1/AC2: nombre del alumno, fecha y ficha del registro asociado.
    const [loadedRows, setLoadedRows] = useState([]);

    useEffect(() => {
        let alive = true;
        const source = reviewerActorIds ? justifications : reviewItems;
        if (!isReviewer || source.length === 0) {
            setLoadedRows([]);
            return () => {
                alive = false;
            };
        }

        (async () => {
            let withRecords = [];

            if (reviewerActorIds) {
                // Instructor: primero los registros de su alcance (una petición
                // por alumno, acotada) y después el cruce con las justificaciones.
                // Al revés haría falta pedir el detalle de las 300+ justificaciones
                // y los que quedaran fuera del tope no aparecerían nunca.
                const actorIds = [...reviewerActorIds].slice(0, MAX_SCOPE_ACTORS);
                // En secuencia: byActor hace findAll en el backend y en paralelo
                // agota su heap (OutOfMemoryError) y deja el servicio sin respuesta.
                const lists = await batched(
                    actorIds,
                    (id) => attendanceApi.recordsByActor(Number(id)).catch(() => []),
                    1
                );
                if (!alive) return;
                const recordById = new Map();
                for (const record of lists.flat()) {
                    recordById.set(Number(record.attendanceRecordId), record);
                }
                withRecords = justifications
                    .filter((j) => recordById.has(Number(j.attendanceRecordId)))
                    .map((j) => ({ ...j, record: recordById.get(Number(j.attendanceRecordId)) }));
            } else {
                const recordIds = [...new Set(reviewItems.map((j) => Number(j.attendanceRecordId)))];
                const recordList = await batched(recordIds, (id) =>
                    attendanceApi.getRecord(id).catch(() => null)
                );
                if (!alive) return;
                const byId = new Map(
                    recordList.filter(Boolean).map((r) => [Number(r.attendanceRecordId), r])
                );
                withRecords = reviewItems.map((j) => ({
                    ...j,
                    record: byId.get(Number(j.attendanceRecordId)) || null,
                }));
            }

            const rows = withRecords
                .filter((row) => {
                    // AC1: el revisor solo ve justificaciones de su alcance.
                    if (!row.record) return false;
                    if (reviewerActorIds && !reviewerActorIds.has(Number(row.record.academicActorId))) {
                        return false;
                    }
                    return true;
                })
                .map((row) => ({
                    ...row,
                    personName: personNameOf(row.record?.academicActorId),
                    date: sessionDate(row.record),
                    recordStatus: row.record?.attendanceStatus,
                }))
                .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

            if (alive) setLoadedRows(rows);
        })();

        return () => {
            alive = false;
        };
    }, [isReviewer, justifications, reviewItems, reviewerActorIds, personNameOf, sessionDate]);

    const reviewRows = useMemo(
        () =>
            loadedRows
                .filter((row) =>
                    reviewTab === "pending" ? row.reviewStatus === "Pending" : row.reviewStatus !== "Pending"
                )
                .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt))),
        [loadedRows, reviewTab]
    );

    const pendingCount = useMemo(
        () => loadedRows.filter((row) => row.reviewStatus === "Pending").length,
        [loadedRows]
    );

    const typeNameOf = useCallback(
        (id) => types.find((x) => Number(x.justificationTypeId) === Number(id))?.name || "—",
        [types]
    );

    // ── Acciones: alumno ─────────────────────────────────────
    const openSubmit = useCallback((record) => {
        setSubmitTarget(record);
        setSubmitOpen(true);
        setFeedback(null);
    }, []);

    // Retirar una justificación todavía Pendiente (eliminar lógico).
    const [withdrawTarget, setWithdrawTarget] = useState(null);
    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const askWithdraw = useCallback((item) => {
        if (!item || item.reviewStatus !== "Pending") return;
        setWithdrawTarget(item);
        setWithdrawOpen(true);
    }, []);

    const confirmWithdraw = useCallback(async () => {
        if (!withdrawTarget) return;
        setIsWithdrawing(true);
        setFeedback(null);
        try {
            await attendanceApi.deleteJustification(withdrawTarget.justificationId);
            setWithdrawOpen(false);
            setWithdrawTarget(null);
            setFeedback({
                type: "success",
                message: t("Justificación retirada."),
            });
            await refresh();
        } catch (e) {
            setWithdrawOpen(false);
            setFeedback({
                type: "error",
                message: e?.message || t("No se pudo retirar la justificación."),
            });
        } finally {
            setIsWithdrawing(false);
        }
    }, [withdrawTarget, refresh, t]);

    const closeSubmit = useCallback(() => {
        setSubmitOpen(false);
        setSubmitTarget(null);
    }, []);

    const submit = useCallback(
        async ({ typeId, reason, file }) => {
            if (!submitTarget) return false;

            // AC3 / HU-JUS-001: el motivo es obligatorio.
            if (!reason || !reason.trim()) {
                setFeedback({ type: "error", message: t("El motivo de la justificación es obligatorio.") });
                return false;
            }
            // AC5: no duplicar justificaciones sobre el mismo registro.
            if (justifiedRecordIds.has(Number(submitTarget.attendanceRecordId))) {
                setFeedback({
                    type: "error",
                    message: t("Ese registro ya tiene una justificación en curso o resuelta."),
                });
                return false;
            }
            // AC4: formato y tamaño del soporte.
            if (file) {
                const extension = String(file.name || "").split(".").pop()?.toLowerCase();
                if (!ALLOWED_DOC_TYPES.includes(extension)) {
                    setFeedback({
                        type: "error",
                        message: t("Formato no válido. Usa PDF, JPG, JPEG o PNG."),
                    });
                    return false;
                }
                if (file.size && file.size > MAX_DOC_BYTES) {
                    setFeedback({
                        type: "error",
                        message: t("El soporte supera el tamaño máximo de 5 MB."),
                    });
                    return false;
                }
            }

            setIsSubmitting(true);
            setFeedback(null);
            try {
                const created = await attendanceApi.createJustification({
                    attendanceRecordId: submitTarget.attendanceRecordId,
                    justificationTypeId: Number(typeId),
                    reason: reason.trim(),
                });

                if (file) {
                    // ADR-009 (MinIO): el backend solo guarda la referencia del
                    // archivo; aún no existe endpoint de subida de bytes.
                    const extension = String(file.name || "soporte").split(".").pop()?.toLowerCase() || "bin";
                    const now = new Date();
                    const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
                    const uid =
                        typeof crypto !== "undefined" && crypto.randomUUID
                            ? crypto.randomUUID()
                            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                    await attendanceApi.createSupportingDocument({
                        justificationId: created.justificationId,
                        fileName: file.name,
                        storageUri: `justification-documents/${folder}/${uid}.${extension}`,
                        mimeType: file.type || "application/octet-stream",
                        sizeBytes: file.size || 1,
                    });
                }

                setFeedback({
                    type: "success",
                    message: t("Justificación enviada. Su estado es Pendiente hasta que sea revisada."),
                });
                setSubmitOpen(false);
                setSubmitTarget(null);
                setListTab("mine");
                await refresh();
                return true;
            } catch (e) {
                const forbidden = e?.status === 403;
                setFeedback({
                    type: "error",
                    message: forbidden
                        ? t(
                              "Tu rol no tiene permiso para registrar justificaciones (attendance.record:write)."
                          )
                        : e?.message || t("No se pudo enviar la justificación."),
                });
                return false;
            } finally {
                setIsSubmitting(false);
            }
        },
        [submitTarget, justifiedRecordIds, refresh, t]
    );

    // ── Acciones: revisor ────────────────────────────────────
    const openDetail = useCallback(
        async (row) => {
            setDetail(row);
            setDocuments([]);
            setDecision(null);
            setNotes("");
            setFeedback(null);
            setDocumentsLoading(true);
            try {
                const docs = await attendanceApi.justificationDocuments(row.justificationId);
                setDocuments(docs || []);
            } catch {
                setDocuments([]);
            } finally {
                setDocumentsLoading(false);
            }
        },
        []
    );

    const closeDetail = useCallback(() => {
        setDetail(null);
        setDocuments([]);
        setDecision(null);
        setNotes("");
    }, []);

    const askDecision = useCallback(
        (nextDecision) => {
            // RN-33: no se puede aprobar sin al menos un soporte registrado.
            if (nextDecision === "Approved" && documents.length === 0) {
                setFeedback({
                    type: "error",
                    message: t("No se puede aprobar: la justificación no tiene soporte registrado."),
                });
                return;
            }
            setDecision(nextDecision);
            setConfirmOpen(true);
        },
        [documents, t]
    );

    const confirmReview = useCallback(async () => {
        if (!detail || !decision) return;
        setIsReviewing(true);
        setFeedback(null);
        try {
            await attendanceApi.reviewJustification(detail.justificationId, {
                reviewStatus: decision,
                reviewedBy: user?.id ?? null,
                resolutionNotes: notes?.trim() || null,
            });
            // HU-JUS-003: avisar al estudiante (fire-and-forget: un fallo
            // de notificaciones jamás revierte una evaluación guardada).
            notifyJustificationResult(detail.record?.academicActorId).catch((e) =>
                console.warn("[FaceAttend] no se pudo notificar el resultado:", e?.message)
            );
            setConfirmOpen(false);
            setFeedback({
                type: "success",
                message:
                    decision === "Approved"
                        ? t("Justificación aprobada. El registro de asistencia queda como Justificada.")
                        : t("Justificación rechazada. El registro conserva su estado original."),
            });
            closeDetail();
            await refresh();
        } catch (e) {
            setConfirmOpen(false);
            setFeedback({
                type: "error",
                message: e?.message || t("No se pudo registrar la evaluación."),
            });
        } finally {
            setIsReviewing(false);
        }
    }, [detail, decision, notes, user, closeDetail, refresh, t]);

    return {
        mode,
        isReviewer,
        isLoading,
        error,
        feedback,
        clearFeedback: () => setFeedback(null),
        types,
        // alumno
        listTab,
        setListTab,
        myJustifications,
        eligibleRecords,
        submitOpen,
        submitTarget,
        isSubmitting,
        openSubmit,
        closeSubmit,
        submit,
        withdrawTarget,
        withdrawOpen,
        setWithdrawOpen,
        askWithdraw,
        confirmWithdraw,
        isWithdrawing,
        // revisor
        reviewTab,
        setReviewTab,
        reviewRows,
        pendingCount,
        resolvedCount: loadedRows.length - pendingCount,
        // Solo el alcance de sede completa recorta la lista: el instructor
        // cruza todas las justificaciones contra sus propios alumnos.
        truncated: isReviewer && reviewerActorIds == null && justifications.length > MAX_ENRICHED_ITEMS,
        detail,
        documents,
        documentsLoading,
        openDetail,
        closeDetail,
        decision,
        notes,
        setNotes,
        confirmOpen,
        setConfirmOpen,
        askDecision,
        confirmReview,
        isReviewing,
        typeNameOf,
        REVIEW_STATUS_LABELS: REVIEW_STATUS_LABELS,
    };
}
