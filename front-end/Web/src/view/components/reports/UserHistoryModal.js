// ============================================================
//  FaceAttend EDU — UserHistoryModal
//
//  Modal para mostrar el historial completo de asistencia
//  de un usuario específico.
// ============================================================

import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Badge, Avatar, Button } from "../common";
import { AnimatedDropdown } from "../common/animation/AnimatedDropdown";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useDateFormat } from "../hooks/useDateFormat";
import { useAppData } from "../../../context/AppDataContext";
import {
    getConfiguredAcademicPeriodType,
    getYearAcademicPeriodsByMonth,
    formatPeriodLabel,
} from "../../../core/constants/academicPeriods";
import { onInstitutionConfigChange } from "../../../core/config/institutionConfig";

export default function UserHistoryModal({
    user,
    onClose,
    closeOnBackdrop = false, // Por defecto NO se cierra al hacer clic fuera
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const { students, courses, environments } = useAppData();
    const { formatDate } = useDateFormat();
    const c = theme.colors;

    // Componente interno para renderizar cada registro de asistencia
    function AttendanceRecordRow({ record, index, isLast, environment, instructor }) {
        const statusConfig = {
            present: {
                variant: "success",
                label: "Presente",
                icon: "check-circle",
                iconColor: c.status.success,
            },
            late: {
                variant: "warning",
                label: "Retardo",
                icon: "alert-circle",
                iconColor: c.status.warning,
            },
            absent: {
                variant: "danger",
                label: "Ausente",
                icon: "x-circle",
                iconColor: c.status.danger,
            }
        };
        
        const config = record.late ? statusConfig.late : (record.present ? statusConfig.present : statusConfig.absent);
        
        return (
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    gap: 14,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: c.border.primary,
                    backgroundColor: index % 2 === 0 ? c.background.surface : c.background.app,
                }}
            >
                {/* Icono de estado */}
                <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: config.iconColor + "20",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <Feather name={config.icon} size={18} color={config.iconColor} />
                </View>

                {/* Información principal */}
                <View style={{ flex: 1, gap: 6 }}>
                    {/* Fecha */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                    }}>
                        <Feather name="calendar" size={14} color={c.text.secondary} />
                        <Text style={{
                            fontSize: 15,
                            fontWeight: "700",
                            color: c.text.primary,
                        }}>
                            {formatDate(record.date, "DD/MM/YYYY")}
                        </Text>
                        <Text style={{ fontSize: 13, color: c.text.disabled }}>•</Text>
                        <Text style={{
                            fontSize: 14,
                            color: c.text.secondary,
                            fontWeight: "500",
                        }}>
                            {formatDate(record.date, "dddd")}
                        </Text>
                    </View>

                    {/* Ambiente e Instructor */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                    }}>
                        {environment && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                <Feather name="map-pin" size={13} color={c.text.secondary} />
                                <Text style={{
                                    fontSize: 13,
                                    color: c.text.secondary,
                                    fontWeight: "500",
                                }}>
                                    Salón {environment}
                                </Text>
                            </View>
                        )}
                        
                        {instructor && environment && (
                            <Text style={{ fontSize: 13, color: c.text.disabled, fontWeight: "600" }}>•</Text>
                        )}
                        
                        {instructor && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                <Feather name="user" size={13} color={c.text.secondary} />
                                <Text style={{
                                    fontSize: 13,
                                    color: c.text.secondary,
                                    fontWeight: "500",
                                }}>
                                    {instructor}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Horarios */}
                    {record.present && (record.checkInTime || record.checkOutTime) && (
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                        }}>
                            {record.checkInTime && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                    <Feather name="log-in" size={13} color={record.late ? c.status.warning : c.status.success} />
                                    <Text style={{
                                        fontSize: 13,
                                        color: record.late ? c.status.warning : c.text.secondary,
                                        fontWeight: record.late ? "700" : "500",
                                    }}>
                                        Entrada: {record.checkInTime}
                                    </Text>
                                </View>
                            )}
                            
                            {record.checkOutTime && (
                                <>
                                    {record.checkInTime && (
                                        <Text style={{ fontSize: 13, color: c.text.disabled, fontWeight: "600" }}>|</Text>
                                    )}
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                        <Feather name="log-out" size={13} color={c.text.secondary} />
                                        <Text style={{ fontSize: 13, color: c.text.secondary, fontWeight: "500" }}>
                                            Salida: {record.checkOutTime}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>
                    )}
                </View>

                {/* Badge de estado */}
                <Badge variant={config.variant} size="sm">
                    {config.label}
                </Badge>
            </View>
        );
    }

    // Estado para el tipo de período académico (reactivo a cambios en Settings)
    const [academicPeriodType, setAcademicPeriodType] = useState(() => getConfiguredAcademicPeriodType());
    
    // Escuchar cambios en la configuración institucional
    useEffect(() => {
        const cleanup = onInstitutionConfigChange((newConfig) => {
            // Actualizar el tipo de período si cambió
            if (newConfig.academicPeriodType && newConfig.academicPeriodType !== academicPeriodType) {
                setAcademicPeriodType(newConfig.academicPeriodType);
            }
        });
        
        return cleanup;
    }, [academicPeriodType]);
    
    // Obtener año actual
    const currentYear = new Date().getFullYear();
    
    // Obtener todos los períodos del año vigente
    const yearPeriods = useMemo(() => {
        return getYearAcademicPeriodsByMonth(academicPeriodType, currentYear);
    }, [academicPeriodType, currentYear]);
    
    // Encontrar el período actual
    const currentPeriod = useMemo(() => {
        return yearPeriods.find(p => p.isCurrent) || yearPeriods[0];
    }, [yearPeriods]);
    
    // Estado para el período seleccionado
    const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
    
    // Actualizar el período seleccionado cuando cambian los yearPeriods o el tipo de período
    useEffect(() => {
        console.log('[UserHistoryModal] Actualizando período seleccionado:', {
            academicPeriodType,
            currentPeriod: currentPeriod?.label,
            selectedPeriod: selectedPeriod?.label
        });
        
        // SIEMPRE resetear al período actual cuando cambia el tipo de período académico
        setSelectedPeriod(currentPeriod);
    }, [academicPeriodType, currentPeriod]);

    // Obtener el estudiante completo con su historial
    const fullStudent = useMemo(() => {
        // Usar studentId si está disponible (para registros expandidos), sino user.id
        const idToSearch = user.studentId || user.id;
        return students.find(s => s.id === idToSearch);
    }, [students, user.id, user.studentId]);

    // Obtener y ordenar el historial de asistencia (más reciente primero)
    // Filtrado por el período seleccionado
    const attendanceHistory = useMemo(() => {
        if (!fullStudent?.attendanceHistory) return [];
        
        // Obtener todas las fechas del historial
        let filteredHistory = [...fullStudent.attendanceHistory];
        
        // Si hay un período seleccionado, filtrar por las semanas del período
        if (selectedPeriod) {
            filteredHistory = filteredHistory.filter(record => {
                const recordDate = new Date(record.date);
                const yearStart = new Date(recordDate.getFullYear(), 0, 1);
                
                // Calcular número de semana del año para el registro
                const dayOfYear = Math.floor((recordDate - yearStart) / (24 * 60 * 60 * 1000)) + 1;
                const weekNumber = Math.ceil(dayOfYear / 7);
                
                // Verificar si la semana está dentro del rango del período seleccionado
                return weekNumber >= selectedPeriod.startWeek && weekNumber <= selectedPeriod.endWeek;
            });
        }
        
        return filteredHistory.sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );
    }, [fullStudent, selectedPeriod]);

    // Calcular estadísticas
    const stats = useMemo(() => {
        const total = attendanceHistory.length;
        const present = attendanceHistory.filter(r => r.present).length;
        const absent = total - present;
        const late = attendanceHistory.filter(r => r.late).length;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

        return { total, present, absent, late, percentage };
    }, [attendanceHistory]);

    // Obtener información del curso y ambiente
    const courseInfo = useMemo(() => {
        if (!fullStudent?.course) return null;
        
        const course = courses.find(c => c.code === fullStudent.course || c.id === fullStudent.course);
        if (!course) return null;

        let environmentName = "Sin ambiente";
        let instructorName = null;
        let instructorId = null;
        
        if (course.room) {
            const environment = environments.find(env => env.id === course.room);
            if (environment?.number) {
                environmentName = environment.number;
            }
            
            // Obtener información del instructor desde el schedule del ambiente
            if (environment?.schedules && environment.schedules.length > 0) {
                const courseSchedule = environment.schedules.find(
                    sch => sch.courseCode === fullStudent.course
                );
                if (courseSchedule) {
                    instructorName = courseSchedule.instructorName || null;
                    instructorId = courseSchedule.instructor || null;
                } else if (environment.schedules[0]) {
                    instructorName = environment.schedules[0].instructorName || null;
                    instructorId = environment.schedules[0].instructor || null;
                }
            }
        }

        return {
            name: course.name,
            code: course.code,
            environment: environmentName,
            instructorName,
            instructorId,
        };
    }, [fullStudent, courses, environments]);

    // Handler para cambio de período
    const handlePeriodSelect = (periodId) => {
        const period = yearPeriods.find(p => p.id === periodId);
        if (period) {
            setSelectedPeriod(period);
        }
    };

    // Preparar items del dropdown con descripción de semanas e indicador de período actual
    const dropdownItems = useMemo(() => {
        return yearPeriods.map(period => ({
            value: period.id,
            label: period.isCurrent 
                ? `${formatPeriodLabel(period, academicPeriodType)} • Actual`
                : formatPeriodLabel(period, academicPeriodType),
            description: `Semanas ${period.startWeek}-${period.endWeek}`,
        }));
    }, [yearPeriods, academicPeriodType]);

    if (!user || !fullStudent) return null;

    return (
        <Modal transparent animationType="fade" onRequestClose={onClose}>
            <View
                style={{
                    flex: 1,
                    backgroundColor: c.background.overlay,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 24,
                }}
            >
                <View style={{
                    backgroundColor: c.background.surface,
                    borderRadius: 16,
                    width: 600,
                    maxHeight: "90%",
                    overflow: "hidden",
                    shadowColor: "#000",
                    shadowOpacity: 0.25,
                    shadowRadius: 12,
                    elevation: 10,
                }}>
                    {/* Header */}
                    <View style={{
                        padding: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border.primary,
                        backgroundColor: c.background.surfaceVariant,
                    }}>
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 4,
                        }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                <Avatar name={fullStudent.name} size={36} />
                                <View>
                                    <Text style={{ fontSize: 17, fontWeight: "700", color: c.text.primary, lineHeight: 20 }}>
                                        {fullStudent.name}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: c.text.secondary, marginTop: 2, lineHeight: 15 }}>
                                        {fullStudent.code}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                onPress={onClose}
                                style={{
                                    padding: 4,
                                    borderRadius: 6,
                                    backgroundColor: c.background.surface,
                                }}
                            >
                                <Feather name="x" size={18} color={c.text.secondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Información del curso */}
                        {courseInfo && (
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                paddingVertical: 2,
                                paddingHorizontal: 10,
                                backgroundColor: c.background.surface,
                                borderRadius: 6,
                            }}>
                                <Feather name="book-open" size={14} color={c.brand.primary} />
                                <Text style={{ fontSize: 13, color: c.text.primary, flex: 1, fontWeight: "500", lineHeight: 16 }}>
                                    {courseInfo.name}
                                </Text>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                    <Feather name="map-pin" size={18} color={c.text.secondary} />
                                    <Text style={{ fontSize: 16, color: c.text.secondary, lineHeight: 16, fontWeight: "500" }}>
                                        {courseInfo.environment}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Estadísticas */}
                    <View style={{
                        padding: 10,
                        backgroundColor: c.background.app,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border.primary,
                    }}>
                        <View style={{
                            flexDirection: "row",
                            gap: 8,
                        }}>
                            {/* Total registros */}
                            <View style={{
                                flex: 1,
                                padding: 8,
                                backgroundColor: c.background.surface,
                                borderRadius: 10,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: c.border.primary,
                            }}>
                                <Feather name="calendar" size={16} color={c.text.secondary} style={{ marginBottom: 3 }} />
                                <Text style={{ fontSize: 20, fontWeight: "800", color: c.text.primary, marginBottom: 1 }}>
                                    {stats.total}
                                </Text>
                                <Text style={{ fontSize: 9, color: c.text.secondary, fontWeight: "600" }}>
                                    Total
                                </Text>
                            </View>

                            {/* Presentes */}
                            <View style={{
                                flex: 1,
                                padding: 8,
                                backgroundColor: c.status.success + "15",
                                borderRadius: 10,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: c.status.success + "30",
                            }}>
                                <Feather name="check-circle" size={16} color={c.status.success} style={{ marginBottom: 3 }} />
                                <Text style={{ fontSize: 20, fontWeight: "800", color: c.status.success, marginBottom: 1 }}>
                                    {stats.present}
                                </Text>
                                <Text style={{ fontSize: 9, color: c.text.secondary, fontWeight: "600" }}>
                                    Presentes
                                </Text>
                            </View>

                            {/* Ausentes */}
                            <View style={{
                                flex: 1,
                                padding: 8,
                                backgroundColor: c.status.danger + "15",
                                borderRadius: 10,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: c.status.danger + "30",
                            }}>
                                <Feather name="x-circle" size={16} color={c.status.danger} style={{ marginBottom: 3 }} />
                                <Text style={{ fontSize: 20, fontWeight: "800", color: c.status.danger, marginBottom: 1 }}>
                                    {stats.absent}
                                </Text>
                                <Text style={{ fontSize: 9, color: c.text.secondary, fontWeight: "600" }}>
                                    Ausentes
                                </Text>
                            </View>

                            {/* Tardes */}
                            <View style={{
                                flex: 1,
                                padding: 8,
                                backgroundColor: c.status.warning + "15",
                                borderRadius: 10,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: c.status.warning + "30",
                            }}>
                                <Feather name="alert-circle" size={16} color={c.status.warning} style={{ marginBottom: 3 }} />
                                <Text style={{ fontSize: 20, fontWeight: "800", color: c.status.warning, marginBottom: 1 }}>
                                    {stats.late}
                                </Text>
                                <Text style={{ fontSize: 9, color: c.text.secondary, fontWeight: "600" }}>
                                    Retardos
                                </Text>
                            </View>

                            {/* Porcentaje */}
                            <View style={{
                                flex: 1,
                                padding: 8,
                                backgroundColor: c.brand.primary + "15",
                                borderRadius: 10,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: c.brand.primary + "30",
                            }}>
                                <Feather name="percent" size={16} color={c.brand.primary} style={{ marginBottom: 3 }} />
                                <Text style={{ fontSize: 20, fontWeight: "800", color: c.brand.primary, marginBottom: 1 }}>
                                    {stats.percentage}%
                                </Text>
                                <Text style={{ fontSize: 9, color: c.text.secondary, fontWeight: "600" }}>
                                    Asistencia
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Encabezado del historial con filtros - SIEMPRE visible */}
                    <View style={{
                        padding: 10,
                        paddingHorizontal: 16,
                        backgroundColor: c.background.surfaceVariant,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border.primary,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "nowrap",
                    }}>
                        {/* Título */}
                        <Text 
                            style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: c.text.primary,
                            }}
                            numberOfLines={1}
                        >
                            Historial de asistencia ({attendanceHistory.length} {attendanceHistory.length === 1 ? 'registro' : 'registros'})
                        </Text>
                        
                        {/* Filtro de período académico */}
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            flexShrink: 0,
                        }}>
                            <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
                                <Text 
                                    style={{
                                        fontSize: 10,
                                        fontWeight: "600",
                                        color: c.text.secondary,
                                        whiteSpace: "nowrap",
                                    }}
                                    numberOfLines={1}
                                >
                                    Filtrar por período académico
                                </Text>
                                <Text 
                                    style={{
                                        fontSize: 9,
                                        color: c.text.tertiary,
                                        whiteSpace: "nowrap",
                                    }}
                                    numberOfLines={1}
                                >
                                    {selectedPeriod ? `Semanas ${selectedPeriod.startWeek}-${selectedPeriod.endWeek}` : ''}
                                </Text>
                            </View>
                            <View style={{ width: 200, flexShrink: 0 }}>
                                <AnimatedDropdown
                                    items={dropdownItems}
                                    value={selectedPeriod?.id}
                                    onSelect={handlePeriodSelect}
                                    placeholder="Selecciona período"
                                    triggerHeight={32}
                                    maxVisible={6}
                                />
                            </View>
                        </View>
                    </View>
                    
                    {/* Lista de registros o mensaje vacío */}
                    {attendanceHistory.length === 0 ? (
                        <View style={{
                            padding: 48,
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 285,
                        }}>
                            <Feather name="calendar" size={56} color={c.text.disabled} style={{ marginBottom: 16 }} />
                            <Text style={{
                                fontSize: 16,
                                fontWeight: "600",
                                color: c.text.secondary,
                                marginBottom: 6,
                            }}>
                                Sin registros de asistencia
                            </Text>
                            <Text style={{
                                fontSize: 13,
                                color: c.text.tertiary,
                                textAlign: "center",
                            }}>
                                Este usuario aún no tiene registros de asistencia
                            </Text>
                        </View>
                    ) : (
                        <ScrollView 
                            style={{ maxHeight: 285 }}
                            showsVerticalScrollIndicator={true}
                        >
                            {attendanceHistory.map((record, index) => (
                                <AttendanceRecordRow
                                    key={`${record.date}-${index}`}
                                    record={record}
                                    index={index}
                                    isLast={index === attendanceHistory.length - 1}
                                    environment={courseInfo?.environment}
                                    instructor={courseInfo?.instructorName}
                                />
                            ))}
                        </ScrollView>
                    )}

                    {/* Footer */}
                    <View style={{
                        padding: 10,
                        borderTopWidth: 1,
                        borderTopColor: c.border.primary,
                        flexDirection: "row",
                        gap: 10,
                        justifyContent: "flex-end",
                        backgroundColor: c.background.surface,
                    }}>
                        <Button variant="primary" onPress={onClose}>
                            {t("Cerrar")}
                        </Button>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
