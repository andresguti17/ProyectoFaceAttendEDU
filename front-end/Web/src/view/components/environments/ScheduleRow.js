// ============================================================
//  ScheduleRow — Fila de horario en detalle de ambiente
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Badge } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useDateFormat } from "../hooks/useDateFormat";

/**
 * Fila de horario con información y acciones
 * 
 * @param {object} schedule - Objeto de horario
 * @param {function} onEdit - Callback para editar
 * @param {function} onDelete - Callback para eliminar
 * @param {boolean} isLast - Si es la última fila
 */
export function ScheduleRow({ schedule, onEdit, onDelete, isLast, canManage = true }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const { formatTime } = useDateFormat();
    const c = theme.colors;

    // Parsear las horas del horario y formatearlas según la configuración
    const parseAndFormatTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return formatTime(date);
    };

    const formattedStartTime = parseAndFormatTime(schedule.startTime);
    const formattedEndTime = parseAndFormatTime(schedule.endTime);
    
    return (
        <View style={{
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: isLast ? 0 : 1,
            borderBottomColor: c.border.primary,
            gap: 8,
        }}>
            <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
            }}>
                <View style={{ flex: 1, gap: 6 }}>
                    {/* Código y nombre del curso */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                    }}>
                        <Badge variant="primary">{schedule.courseCode}</Badge>
                        <Text style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: c.text.primary,
                            flex: 1,
                        }} numberOfLines={1}>
                            {schedule.courseName}
                        </Text>
                    </View>
                    
                    {/* Instructor */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                    }}>
                        <Feather name="user" size={14} color={c.text.secondary} />
                        <Text style={{
                            fontSize: 12,
                            color: c.text.secondary,
                        }}>
                            {schedule.instructorName}
                        </Text>
                    </View>
                    
                    {/* Horario y días */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                    }}>
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                        }}>
                            <Feather name="clock" size={14} color={c.text.secondary} />
                            <Text style={{
                                fontSize: 12,
                                color: c.text.secondary,
                            }}>
                                {formattedStartTime} — {formattedEndTime}
                            </Text>
                        </View>
                        
                        <View style={{
                            flexDirection: "row",
                            gap: 4,
                            flexWrap: "wrap",
                        }}>
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
                
                {/* Acciones (solo gestión) */}
                {canManage && (
                    <View style={{
                        flexDirection: "row",
                        gap: 8,
                        marginLeft: 12,
                    }}>
                        <TouchableOpacity
                            onPress={onEdit}
                            style={{
                                padding: 8,
                                borderRadius: 6,
                                backgroundColor: c.brand.primaryLight,
                            }}
                        >
                            <Feather name="edit-2" size={16} color={c.brand.primary} />
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            onPress={onDelete}
                            style={{
                                padding: 8,
                                borderRadius: 6,
                                backgroundColor: c.status.dangerLight,
                            }}
                        >
                            <Feather name="trash-2" size={16} color={c.status.danger} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

export default ScheduleRow;
