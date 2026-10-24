// ============================================================
//  FaceAttend EDU — ClassCard
//
//  Tarjeta de una clase de hoy en el kiosco de asistencia: curso y
//  ficha, estado de la sesión, horario, ambiente y matriculados /
//  asistencia. Se pinta con lo que haya: sin detalles cae a "Clase de hoy".
//  Importa de archivos concretos, no del barrel `common` (ver cabecera
//  de AttendanceKioskView).
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card } from "../common/cards/Card";
import { Button } from "../common/buttons/Button";
import { Badge } from "../common/badges/Badge";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { formatClockTime } from "../../../core/constants/dateFormats";
import { classTimeInfo, splitMinutes, toMinutes } from "../../../viewmodels/classCards";

const STATUS_BADGE = {
    pending: { variant: "default", label: "Sin iniciar" },
    open: { variant: "success", label: "En curso" },
    closed: { variant: "default", label: "Cerrada" },
    cancelled: { variant: "danger", label: "Cancelada" },
};

const ACTION_LABEL = {
    pending: "Iniciar clase",
    open: "Continuar clase",
};

function InfoCell({ icon, label, value, hint, progress, c }) {
    return (
        <View
            style={{
                flexGrow: 1,
                flexBasis: 150,
                minWidth: 140,
                backgroundColor: c.background.app,
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                gap: 2,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name={icon} size={13} color={c.text.secondary} />
                <Text style={{ color: c.text.secondary, fontSize: 12 }}>{label}</Text>
            </View>
            <Text style={{ color: c.text.primary, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {value}
            </Text>
            {typeof progress === "number" && (
                <View
                    style={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: c.border.primary,
                        overflow: "hidden",
                        marginVertical: 3,
                    }}
                >
                    <View
                        style={{
                            width: `${Math.min(100, Math.max(0, progress))}%`,
                            height: "100%",
                            backgroundColor: c.status.success,
                        }}
                    />
                </View>
            )}
            {!!hint && (
                <Text style={{ color: c.text.secondary, fontSize: 12 }} numberOfLines={1}>
                    {hint}
                </Text>
            )}
        </View>
    );
}

export default function ClassCard({ block, details, loading = false, onStart, now = new Date() }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    // Mientras llegan los datos no se afirma ningún estado: una clase ya abierta
    // no debe verse "Sin iniciar" ni ofrecer "Iniciar clase" por un instante.
    const waiting = loading;
    const status = details?.status ?? "pending";
    const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
    const actionLabel = waiting ? undefined : ACTION_LABEL[status];

    const formatSpan = (total) => {
        const { hours, minutes } = splitMinutes(total);
        if (hours > 0 && minutes > 0) return `${hours} h ${minutes} min`;
        if (hours > 0) return `${hours} h`;
        return `${minutes} min`;
    };

    const start = toMinutes(block.startsAt);
    const end = toMinutes(block.endsAt);
    const duration = start != null && end != null ? Math.max(0, end - start) : null;
    const info = classTimeInfo(block.startsAt, block.endsAt, status, now);

    const hintByKind = {
        starts_in: `${t("Empieza en")} ${formatSpan(info.minutes)}`,
        due: t("Es hora de empezar"),
        missed: t("El horario ya terminó"),
        remaining: `${t("Quedan")} ${formatSpan(info.minutes)}`,
        overtime: t("Pasó la hora de fin"),
        ended_ago: `${t("Terminó hace")} ${formatSpan(info.minutes)}`,
        duration: duration != null ? formatSpan(duration) : "",
        none: "",
    };
    const showDuration = status === "pending" && duration != null && info.kind !== "none";
    const scheduleHint = `${showDuration ? `${formatSpan(duration)} · ` : ""}${hintByKind[info.kind] ?? ""}`.trim();

    const enrolled = details?.enrolled ?? 0;
    const registered = details?.registered;
    const showsAttendance = !waiting && (status === "open" || status === "closed") && registered != null;
    const percent = enrolled > 0 && registered != null ? Math.round((registered / enrolled) * 100) : 0;

    const subtitle = [
        details?.fichaCode ? `${t("Ficha")} ${details.fichaCode}` : "",
        details?.courseCode ? `${t("Código")} ${details.courseCode}` : "",
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <Card
            padding="lg"
            style={status === "open" ? { borderColor: c.status.success, borderWidth: 1 } : undefined}
            contentStyle={{ gap: 14 }}
        >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: c.text.primary, fontSize: 16, fontWeight: "700" }}>
                        {details?.courseName || t("Clase de hoy")}
                    </Text>
                    {!!subtitle && (
                        <Text style={{ color: c.text.secondary, fontSize: 13 }}>{subtitle}</Text>
                    )}
                </View>
                {waiting ? (
                    <Text style={{ color: c.text.secondary, fontSize: 12 }}>{t("Cargando…")}</Text>
                ) : (
                    <Badge variant={badge.variant}>{t(badge.label)}</Badge>
                )}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <InfoCell
                    c={c}
                    icon="clock"
                    label={t("Horario")}
                    value={`${formatClockTime(block.startsAt)} – ${formatClockTime(block.endsAt)}`}
                    hint={waiting ? "" : scheduleHint}
                />
                <InfoCell
                    c={c}
                    icon="map-pin"
                    label={t("Ambiente")}
                    value={waiting && !details ? "…" : details?.environmentName || "—"}
                    hint={!waiting && details?.capacity != null ? `${t("Capacidad")} ${details.capacity}` : ""}
                />
                {showsAttendance ? (
                    <InfoCell
                        c={c}
                        icon="users"
                        label={t("Asistencia")}
                        value={`${registered} ${t("de")} ${enrolled}`}
                        progress={status === "open" ? percent : undefined}
                        hint={status === "closed" ? `${percent} % ${t("presentes")}` : ""}
                    />
                ) : (
                    <InfoCell
                        c={c}
                        icon="users"
                        label={t("Estudiantes")}
                        value={
                            waiting
                                ? "…"
                                : `${enrolled} ${enrolled === 1 ? t("matriculado") : t("matriculados")}`
                        }
                        hint={waiting ? "" : status === "cancelled" ? t("Clase cancelada") : t("Aún sin registros")}
                    />
                )}
            </View>

            {!!actionLabel && (
                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                    <Button variant="primary" onPress={() => onStart(block)}>
                        {t(actionLabel)}
                    </Button>
                </View>
            )}
        </Card>
    );
}
