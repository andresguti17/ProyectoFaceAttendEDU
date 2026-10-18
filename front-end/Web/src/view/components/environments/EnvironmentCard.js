// ============================================================
//  EnvironmentCard — Tarjeta de ambiente en vista de grid
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card, Button, Badge } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { formatTime } from "../../../core/constants/dateFormats";

// Etiqueta corta de día (Lun..Dom) -> getDay() (0..6).
const DAY_TO_GETDAY = { Dom: 0, Lun: 1, Mar: 2, "Mié": 3, Mie: 3, Jue: 4, Vie: 5, "Sáb": 6, Sab: 6 };

function minutesOf(timeStr) {
    if (!timeStr) return null;
    const [h, m] = String(timeStr).split(":").map(Number);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
    return h * 60 + m;
}

// Marca "En clase ahora" si algún día del horario es hoy y la hora
// actual cae dentro de [inicio, fin).
function isLiveNow(schedule, now = new Date()) {
    const start = minutesOf(schedule.startTime);
    const end = minutesOf(schedule.endTime);
    if (start == null || end == null) return false;
    const today = now.getDay();
    const days = Array.isArray(schedule.days) ? schedule.days : [];
    if (!days.some((d) => DAY_TO_GETDAY[String(d)] === today)) return false;
    const current = now.getHours() * 60 + now.getMinutes();
    return current >= start && current < end;
}

/**
 * Convierte un string de tiempo (HH:MM) a un objeto Date
 */
function parseTimeToDate(timeStr) {
    if (!timeStr) return new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
}

/**
 * Card de ambiente con sus horarios visibles (boceto aprobado):
 * cada horario muestra día/hora, curso, ficha e instructor, con marca
 * "En clase ahora" cuando cubre el momento actual.
 *
 * @param {object} environment - Objeto de ambiente
 * @param {function} onPress - Callback al hacer click (detalle)
 * @param {function} cohortCodeOf - (cohortId) => código de ficha
 */
export function EnvironmentCard({ environment, onPress, cohortCodeOf }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const codeOf = (schedule) => {
        if (typeof cohortCodeOf === "function") {
            const code = cohortCodeOf(schedule.cohortId);
            if (code) return code;
        }
        return schedule.cohortCode || null;
    };

    return (
        <TouchableOpacity onPress={onPress} style={{ flex: 1, minWidth: 260 }}>
            <Card padding={0} style={{ overflow: "hidden", height: "100%" }}>
                {/* Accent bar */}
                <View style={{ height: 6, backgroundColor: c.brand.primary }} />
                
                <View style={{ padding: 16, flex: 1 }}>
                    {/* Header con número y capacidad */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        marginBottom: 10,
                    }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{
                                fontSize: 18,
                                fontWeight: "700",
                                color: c.brand.primary,
                                marginBottom: 4,
                            }}>
                                {environment.number}
                            </Text>
                            <Text style={{
                                fontSize: 13,
                                color: c.text.secondary,
                                lineHeight: 18,
                                fontStyle: environment.description === "Sin descripción" ? "italic" : "normal",
                            }} numberOfLines={2}>
                                {environment.description === "Sin descripción" ? (
                                    <>
                                        <Text style={{ color: c.status.warning }}>*</Text>
                                        Sin descripción
                                    </>
                                ) : environment.description}
                            </Text>
                        </View>
                        
                        {environment.capacity && (
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                backgroundColor: c.background.app,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 8,
                                marginLeft: 8,
                            }}>
                                <Feather name="users" size={14} color={c.text.secondary} />
                                <Text style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: c.text.secondary,
                                }}>
                                    {environment.capacity}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Divider */}
                    <View style={{
                        height: 1,
                        backgroundColor: c.border.primary,
                        marginVertical: 14,
                    }} />

                    {/* Schedules section - Título FIJO */}
                    <Text style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: c.text.secondary,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 10,
                    }}>
                        {t("Horarios asignados")} ({environment.schedules.length})
                    </Text>

                    {/* Lista de horarios con día/hora, curso, ficha e instructor */}
                    {environment.schedules.length === 0 ? (
                        <Text style={{
                            fontSize: 13,
                            color: c.text.disabled,
                            fontStyle: "italic",
                        }}>
                            {t("Sin horarios asignados")}
                        </Text>
                    ) : (
                        <ScrollView
                            style={{ flex: 1, maxHeight: 190 }}
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled={true}
                        >
                            {environment.schedules.map(schedule => {
                                const live = isLiveNow(schedule);
                                const ficha = codeOf(schedule);
                                return (
                                    <View key={schedule.id} style={{
                                        flexDirection: "row",
                                        alignItems: "flex-start",
                                        gap: 10,
                                        marginBottom: 10,
                                        padding: 10,
                                        borderRadius: 10,
                                        backgroundColor: live ? c.status.success + "14" : c.background.app,
                                        borderWidth: live ? 1 : 0,
                                        borderColor: live ? c.status.success + "40" : "transparent",
                                    }}>
                                        <View style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: 3,
                                            backgroundColor: live ? c.status.success : c.brand.primary,
                                            marginTop: 6,
                                        }} />

                                        <View style={{ flex: 1, gap: 4 }}>
                                            <View style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 6,
                                                flexWrap: "wrap",
                                            }}>
                                                <Badge variant="primary" size="sm">{schedule.courseCode}</Badge>
                                                {ficha && (
                                                    <Badge variant="default" size="sm">{ficha}</Badge>
                                                )}
                                                {live && (
                                                    <Badge variant="success" size="sm">{t("En clase ahora")}</Badge>
                                                )}
                                            </View>
                                            <Text style={{
                                                fontSize: 13,
                                                fontWeight: "600",
                                                color: c.text.primary,
                                            }} numberOfLines={1}>
                                                {schedule.courseName}
                                            </Text>
                                            <Text style={{
                                                fontSize: 12,
                                                color: c.text.secondary,
                                            }} numberOfLines={1}>
                                                {schedule.instructorName}
                                            </Text>
                                            <View style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 6,
                                                flexWrap: "wrap",
                                            }}>
                                                <Feather name="clock" size={12} color={c.text.secondary} />
                                                <Text style={{ fontSize: 12, color: c.text.secondary }}>
                                                    {formatTime(parseTimeToDate(schedule.startTime))}–{formatTime(parseTimeToDate(schedule.endTime))}
                                                </Text>
                                                {schedule.days.map(d => (
                                                    <View key={d} style={{
                                                        backgroundColor: c.brand.primaryLight,
                                                        borderRadius: 4,
                                                        paddingHorizontal: 6,
                                                        paddingVertical: 2,
                                                    }}>
                                                        <Text style={{
                                                            fontSize: 11,
                                                            fontWeight: "700",
                                                            color: c.brand.primary,
                                                        }}>
                                                            {t(d)}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}

                    {/* Ver detalle */}
                    <Button variant="outline" size="sm" onPress={onPress} style={{ marginTop: 12 }}>
                        {t("Ver detalle")}
                    </Button>
                </View>
            </Card>
        </TouchableOpacity>
    );
}

export default EnvironmentCard;
