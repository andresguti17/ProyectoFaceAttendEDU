// ============================================================
//  FaceAttend EDU — Alerts ViewModel
//
//  Bandeja de alertas web (HU-JUS-003, FR 6.3): alertas del propio
//  actor académico (08-ms-notification). Sin actor (super admin sin
//  academic_actor) muestra las no resueltas globales, acotadas.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { notificationApi } from "../services/api/notificationApi";

const PAGE_SIZE = 50;

function alertListOf(response) {
    if (Array.isArray(response)) return response;
    return response?.alerts ?? response?.data ?? response?.content ?? [];
}

// 08-ms-notification (Go) serializa sus entidades sin etiquetas json, así que
// los campos llegan en PascalCase (AlertID, RaisedAt…). Se normalizan a camelCase
// aceptando también snake_case por si el contrato se etiqueta más adelante.
const pick = (o, ...keys) => {
    for (const k of keys) if (o?.[k] !== undefined) return o[k];
    return undefined;
};

export function normalizeAlert(a) {
    return {
        ...a,
        alertId: pick(a, "alertId", "alert_id", "AlertID", "id"),
        academicActorId: pick(a, "academicActorId", "academic_actor_id", "AcademicActorID"),
        alertTypeId: pick(a, "alertTypeId", "alert_type_id", "AlertTypeID"),
        raisedAt: pick(a, "raisedAt", "raised_at", "RaisedAt") ?? null,
        resolvedAt: pick(a, "resolvedAt", "resolved_at", "ResolvedAt") ?? null,
    };
}

export function normalizeAlertType(t) {
    return {
        ...t,
        alertTypeId: pick(t, "alertTypeId", "alert_type_id", "AlertTypeID", "id"),
        code: pick(t, "code", "Code"),
        name: pick(t, "name", "Name"),
        severity: pick(t, "severity", "Severity"),
        channel: pick(t, "channel", "Channel"),
    };
}

function typeListOf(response) {
    if (Array.isArray(response)) return response;
    return response?.alert_types ?? response?.data ?? response?.content ?? [];
}

export function useAlertsViewModel() {
    const { user } = useAuth();
    const { t } = useTranslation();

    const [alerts, setAlerts] = useState([]);
    const [types, setTypes] = useState(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showResolved, setShowResolved] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const actorId = user?.academicActorId ?? null;

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [alertRes, typeRes] = await Promise.all([
                notificationApi.listAlerts({
                    ...(actorId != null ? { actorId } : { resolved: false }),
                    limit: PAGE_SIZE,
                    offset: 0,
                }),
                notificationApi.listAlertTypes().catch(() => []),
            ]);
            setAlerts(alertListOf(alertRes).map(normalizeAlert));
            const map = new Map();
            for (const raw of typeListOf(typeRes)) {
                const type = normalizeAlertType(raw);
                if (type.alertTypeId != null) map.set(Number(type.alertTypeId), type);
            }
            setTypes(map);
        } catch (e) {
            setError(e?.message || t("No se pudieron cargar las alertas."));
        } finally {
            setIsLoading(false);
        }
    }, [actorId, t]);

    useEffect(() => {
        load();
    }, [load]);

    const visible = showResolved ? alerts : alerts.filter((a) => !a.resolvedAt && !a.resolved_at);

    const resolve = useCallback(
        async (alert) => {
            const id = alert.alertId ?? alert.alert_id ?? alert.id;
            if (id == null) return;
            setBusyId(id);
            try {
                await notificationApi.resolveAlert(id);
                setAlerts((prev) =>
                    prev.map((a) =>
                        (a.alertId ?? a.alert_id ?? a.id) === id
                            ? { ...a, resolvedAt: new Date().toISOString(), resolved_at: new Date().toISOString() }
                            : a
                    )
                );
            } catch (e) {
                setError(e?.message || t("No se pudo resolver la alerta."));
            } finally {
                setBusyId(null);
            }
        },
        [t]
    );

    const remove = useCallback(
        async (alert) => {
            const id = alert.alertId ?? alert.alert_id ?? alert.id;
            if (id == null) return;
            setBusyId(id);
            try {
                await notificationApi.deleteAlert(id);
                setAlerts((prev) => prev.filter((a) => (a.alertId ?? a.alert_id ?? a.id) !== id));
            } catch (e) {
                setError(e?.message || t("No se pudo eliminar la alerta."));
            } finally {
                setBusyId(null);
            }
        },
        [t]
    );

    return {
        alerts: visible,
        openCount: alerts.filter((a) => !a.resolvedAt && !a.resolved_at).length,
        types,
        isLoading,
        error,
        showResolved,
        setShowResolved,
        busyId,
        resolve,
        remove,
        refresh: load,
    };
}
