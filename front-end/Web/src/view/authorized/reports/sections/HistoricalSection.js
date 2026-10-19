// ============================================================
//  FaceAttend EDU — Históricos Section
//
//  Sección para mostrar la lista de usuarios con asistencia.
//  Incluye filtros por nombre, ficha y fecha.
// ============================================================

import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { createPortal } from "react-dom";
import { 
    Button, 
    TextInput, 
    AnimatedDropdown,
    DateRangeCalendar,
    Avatar,
    Badge,
    EmptyState,
    Loader,
    Checkbox
} from "../../../components/common";
import { SearchTypeInput } from "../../../components/common/filters";
import { useTheme } from "../../../components/hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { useDateFormat } from "../../../components/hooks/useDateFormat";
import { useAppData } from "../../../../context/AppDataContext";
import { titleCase } from "../../../../core/utils/formatting";
import UserHistoryModal from "../../../components/reports/UserHistoryModal";
import { ExportConfigModal } from "../../../components/reports/ExportConfigModal";
import { useHistoricosViewModel } from "../../../../viewmodels/useHistoricosViewModel";
import { usePushNotification } from "../../../components/common/feedback/PushNotification";
import { exportToExcel, exportToPDF, buildHTMLTable, formatPercentageWithColor, formatStatusBadge } from "../../../../core/utils/exportHelpers";
import { getInstitutionConfig } from "../../../../core/config/institutionConfig";
import { getAttendanceThresholds } from "../../../../models/data/userDerivedData";

function UserRow({ user, index, isLast, onPress, isExportMode, isSelected, onToggleSelect }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const { formatDate } = useDateFormat();
    const c = theme.colors;
    
    const statusConfig = {
        present: {
            variant: "success",
            label: t("Presente"),
            icon: "check-circle",
            iconColor: c.status.success,
        },
        late: {
            variant: "warning",
            label: t("Retardo"),
            icon: "alert-circle",
            iconColor: c.status.warning,
        },
        absent: {
            variant: "danger",
            label: t("Ausente"),
            icon: "x-circle",
            iconColor: c.status.danger,
        }
    };
    
    const config = user.late ? statusConfig.late : (user.status === "present" ? statusConfig.present : statusConfig.absent);
    
    return (
        <TouchableOpacity
            onPress={() => {
                if (isExportMode) {
                    onToggleSelect(user.id);
                } else {
                    onPress();
                }
            }}
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                gap: 12,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: c.border.primary,
                backgroundColor: isSelected ? c.primary + "10" : "transparent",
            }}
        >
            {/* Checkbox en modo exportación */}
            {isExportMode && (
                <View style={{ marginRight: 4 }}>
                    <Checkbox
                        checked={isSelected}
                        onToggle={() => onToggleSelect(user.id)}
                        size="sm"
                        variant="primary"
                    />
                </View>
            )}

            <View style={{ position: "relative" }}>
                <Avatar name={user.studentName} size={40} />
                {user.date && (
                    <View style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: config.iconColor,
                        borderWidth: 2,
                        borderColor: c.background.surface,
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                        <Feather name={config.icon} size={8} color="#fff" />
                    </View>
                )}
            </View>

            <View style={{ flex: 1, gap: 5 }}>
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: c.text.primary,
                        flex: 1,
                    }} numberOfLines={1}>
                        {user.studentName}
                    </Text>
                    
                    {user.date && (
                        <Badge variant={config.variant} size="sm">
                            {config.label}
                        </Badge>
                    )}
                </View>

                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather name="hash" size={12} color={c.text.secondary} style={{ marginTop: 1 }} />
                        <Text style={{ fontSize: 12, color: c.text.secondary, fontWeight: "500", lineHeight: 14 }}>
                            {user.studentCode}
                        </Text>
                    </View>
                    
                    <Text style={{ fontSize: 12, color: c.text.disabled, lineHeight: 14 }}>•</Text>
                    
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather name="map-pin" size={12} color={c.text.secondary} style={{ marginTop: 1 }} />
                        <Text style={{ fontSize: 12, color: c.text.secondary, lineHeight: 14 }}>
                            {user.environment}
                        </Text>
                    </View>
                    
                    {user.instructorName && (
                        <>
                            <Text style={{ fontSize: 12, color: c.text.disabled, lineHeight: 14 }}>•</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Feather name="user" size={12} color={c.text.secondary} style={{ marginTop: 1 }} />
                                <Text style={{ fontSize: 12, color: c.text.secondary, lineHeight: 14 }}>
                                    {user.instructorName}
                                </Text>
                            </View>
                        </>
                    )}
                    
                    {user.date && (
                        <>
                            <Text style={{ fontSize: 12, color: c.text.disabled, lineHeight: 14 }}>•</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Feather name="calendar" size={12} color={c.text.secondary} style={{ marginTop: 1 }} />
                                <Text style={{ fontSize: 12, color: c.text.secondary, lineHeight: 14 }}>
                                    {formatDate(user.date, "DD/MM/YYYY")}
                                </Text>
                            </View>
                        </>
                    )}
                </View>
                
                {/* Horarios - solo mostrar si hay datos de tiempo */}
                {(user.scheduledStartTime || user.actualCheckInTime) && (
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 2,
                    }}>
                        {/* Horario programado */}
                        {user.scheduledStartTime && user.scheduledEndTime && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Feather name="clock" size={11} color={c.text.tertiary} style={{ marginTop: 1 }} />
                                <Text style={{ fontSize: 11, color: c.text.tertiary, lineHeight: 13 }}>
                                    Horario: {user.scheduledStartTime} - {user.scheduledEndTime}
                                </Text>
                            </View>
                        )}
                        
                        {/* Registro real */}
                        {user.actualCheckInTime && user.actualCheckOutTime && (
                            <>
                                {user.scheduledStartTime && (
                                    <Text style={{ fontSize: 11, color: c.text.disabled, lineHeight: 13 }}>|</Text>
                                )}
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Feather name="activity" size={11} color={user.late ? c.status.warning : c.status.success} style={{ marginTop: 1 }} />
                                    <Text style={{ 
                                        fontSize: 11, 
                                        color: user.late ? c.status.warning : c.text.secondary,
                                        lineHeight: 13,
                                        fontWeight: user.late ? "600" : "400"
                                    }}>
                                        Real: {user.actualCheckInTime} - {user.actualCheckOutTime}
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                )}
            </View>

            {!isExportMode && <Feather name="chevron-right" size={20} color={c.text.secondary} />}
        </TouchableOpacity>
    );
}

export const HistoricosSection = forwardRef(({ showFilters, onToggleFilters, onStatsChange, initialCourseFilter }, ref) => {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const appData = useAppData();
    const pushNotification = usePushNotification();
    const { formatDate } = useDateFormat();
    const c = theme.colors;

    const [searchValue, setSearchValue] = useState({ searchType: "student", searchText: "" });
    const [selectedFicha, setSelectedFicha] = useState(initialCourseFilter || "");
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [selectedUser, setSelectedUser] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    
    // Estados para modo de exportación
    const [isExportMode, setIsExportMode] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    const [showExportModal, setShowExportModal] = useState(false);
    
    // Aplicar filtro de curso inicial cuando cambie
    useEffect(() => {
        if (initialCourseFilter) {
            setSelectedFicha(initialCourseFilter);
        }
    }, [initialCourseFilter]);

    /**
     * Handler para cambio de rango de fechas (aplicado directamente)
     */
    const handleDateRangeChange = (range) => {
        setDateRange(range);
    };

    const usersData = useMemo(() => {
        const students = appData.students || [];
        const courses = appData.courses || [];
        const environments = appData.environments || [];
        
        // Deduplicar estudiantes por ID para evitar registros duplicados
        const uniqueStudents = Array.from(
            new Map(students.map(s => [s.id, s])).values()
        );
        
        // Si NO hay filtro de fechas aplicado, mostrar solo el último registro por estudiante
        if (!dateRange.start || !dateRange.end) {
            return uniqueStudents.map(student => {
                let lastRecord = null;
                let environmentName = t("Sin ambiente");
                
                if (student.attendanceHistory && student.attendanceHistory.length > 0) {
                    const sortedHistory = [...student.attendanceHistory].sort(
                        (a, b) => new Date(b.date) - new Date(a.date)
                    );
                    lastRecord = sortedHistory[0];
                }
                
                // Obtener el ambiente y horario desde el curso del estudiante
                const studentCourse = courses.find(c => c.code === student.course || c.id === student.course);
                let scheduledStartTime = null;
                let scheduledEndTime = null;
                let actualCheckInTime = null;
                let actualCheckOutTime = null;
                let instructorName = null;
                let instructorId = null;
                
                if (studentCourse?.room) {
                    const environment = environments.find(env => env.id === studentCourse.room);
                    if (environment?.number) {
                        environmentName = environment.number;
                    }
                    
                    // Obtener horario programado del curso e información del instructor
                    if (environment?.schedules && environment.schedules.length > 0) {
                        const courseSchedule = environment.schedules.find(
                            sch => sch.courseCode === student.course
                        );
                        if (courseSchedule) {
                            scheduledStartTime = courseSchedule.startTime;
                            scheduledEndTime = courseSchedule.endTime;
                            instructorName = courseSchedule.instructorName || null;
                            instructorId = courseSchedule.instructor || null;
                        } else if (environment.schedules[0]) {
                            scheduledStartTime = environment.schedules[0].startTime;
                            scheduledEndTime = environment.schedules[0].endTime;
                            instructorName = environment.schedules[0].instructorName || null;
                            instructorId = environment.schedules[0].instructor || null;
                        }
                    }
                }
                
                // Obtener horas reales del último registro de asistencia
                if (lastRecord) {
                    actualCheckInTime = lastRecord.checkInTime || null;
                    actualCheckOutTime = lastRecord.checkOutTime || null;
                }
                
                // Obtener el nombre de la ficha desde el curso
                const fichaName = studentCourse?.name || student.courseName || student.course || t("Sin ficha");
                
                return {
                    id: student.id,
                    studentId: student.id,
                    studentName: student.name,
                    studentCode: student.code,
                    ficha: student.course,
                    fichaName: fichaName,
                    environment: environmentName,
                    date: lastRecord?.date || null,
                    scheduledStartTime,
                    scheduledEndTime,
                    actualCheckInTime,
                    actualCheckOutTime,
                    instructorName,
                    instructorId,
                    status: lastRecord?.present ? "present" : "absent",
                    late: lastRecord?.late || false,
                    totalRecords: student.attendanceHistory?.length || 0,
                    attendance: student.attendance,
                };
            });
        }
        
        // Si HAY filtro de fechas, expandir TODOS los registros de asistencia
        const allRecords = [];
        
        uniqueStudents.forEach(student => {
            const studentCourse = courses.find(c => c.code === student.course || c.id === student.course);
            let environmentName = t("Sin ambiente");
            let scheduledStartTime = null;
            let scheduledEndTime = null;
            let instructorName = null;
            let instructorId = null;
            
            // Obtener información del ambiente
            if (studentCourse?.room) {
                const environment = environments.find(env => env.id === studentCourse.room);
                if (environment?.number) {
                    environmentName = environment.number;
                }
                
                // Obtener horario programado del curso e información del instructor
                if (environment?.schedules && environment.schedules.length > 0) {
                    const courseSchedule = environment.schedules.find(
                        sch => sch.courseCode === student.course
                    );
                    if (courseSchedule) {
                        scheduledStartTime = courseSchedule.startTime;
                        scheduledEndTime = courseSchedule.endTime;
                        instructorName = courseSchedule.instructorName || null;
                        instructorId = courseSchedule.instructor || null;
                    } else if (environment.schedules[0]) {
                        scheduledStartTime = environment.schedules[0].startTime;
                        scheduledEndTime = environment.schedules[0].endTime;
                        instructorName = environment.schedules[0].instructorName || null;
                        instructorId = environment.schedules[0].instructor || null;
                    }
                }
            }
            
            // Obtener el nombre de la ficha desde el curso
            const fichaName = studentCourse?.name || student.courseName || student.course || t("Sin ficha");
            
            // Si el estudiante tiene historial de asistencia, crear un registro por cada entrada
            if (student.attendanceHistory && student.attendanceHistory.length > 0) {
                student.attendanceHistory.forEach(record => {
                    allRecords.push({
                        id: `${student.id}-${record.date}`, // ID único por estudiante + fecha
                        studentId: student.id,
                        studentName: student.name,
                        studentCode: student.code,
                        ficha: student.course,
                        fichaName: fichaName,
                        environment: environmentName,
                        date: record.date,
                        scheduledStartTime,
                        scheduledEndTime,
                        actualCheckInTime: record.checkInTime || null,
                        actualCheckOutTime: record.checkOutTime || null,
                        instructorName,
                        instructorId,
                        status: record.present ? "present" : "absent",
                        late: record.late || false,
                        totalRecords: student.attendanceHistory.length,
                        attendance: student.attendance,
                    });
                });
            }
        });
        
        return allRecords;
    }, [appData.students, appData.courses, appData.environments, t, dateRange.start, dateRange.end]);

    const availableFichas = useMemo(() => {
        const fichasSet = new Set();
        
        (appData.students || []).forEach(student => {
            if (student.course) {
                fichasSet.add(student.course);
            }
        });
        
        const fichaOptions = Array.from(fichasSet)
            .sort()
            .map(ficha => {
                const course = (appData.courses || []).find(c => c.code === ficha || c.id === ficha);
                return {
                    value: ficha,
                    label: course?.name || ficha,
                    description: `Ficha ${ficha}`,
                    icon: "book-open",
                };
            });
        
        return [
            { value: "", label: t("Todos los cursos"), description: t("Sin filtro"), icon: "filter" },
            ...fichaOptions
        ];
    }, [appData.students, appData.courses, t]);

    const filteredUsers = useMemo(() => {
        let result = usersData;

        if (searchValue.searchText) {
            const searchLower = searchValue.searchText.toLowerCase();
            
            if (searchValue.searchType === "student") {
                // Búsqueda por estudiante (nombre o código)
                result = result.filter(user => 
                    user.studentName.toLowerCase().includes(searchLower) ||
                    user.studentCode.toLowerCase().includes(searchLower)
                );
            } else if (searchValue.searchType === "teacher") {
                // Búsqueda por docente (nombre del instructor)
                result = result.filter(user => 
                    user.instructorName && user.instructorName.toLowerCase().includes(searchLower)
                );
            }
        }

        if (selectedFicha) {
            result = result.filter(user => user.ficha === selectedFicha);
        }

        if (dateRange.start && dateRange.end) {
            result = result.filter(user => {
                if (!user.date) return false;
                
                // Normalizar fechas para comparación (solo fecha, sin hora)
                const userDate = new Date(user.date);
                userDate.setHours(0, 0, 0, 0);
                
                const startDate = new Date(dateRange.start);
                startDate.setHours(0, 0, 0, 0);
                
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999);
                
                return userDate >= startDate && userDate <= endDate;
            });
        }

        // Ordenar por fecha descendente (más reciente primero) y luego por nombre
        return result.sort((a, b) => {
            // Primero por fecha
            if (a.date && b.date) {
                const dateCompare = new Date(b.date) - new Date(a.date);
                if (dateCompare !== 0) return dateCompare;
            } else if (a.date && !b.date) {
                return -1;
            } else if (!a.date && b.date) {
                return 1;
            }
            
            // Luego por nombre
            return a.studentName.localeCompare(b.studentName);
        });
    }, [usersData, searchValue.searchText, searchValue.searchType, selectedFicha, dateRange]);

    // Hook para manejar exportaciones
    const { exportExcel, exportPDF } = useHistoricosViewModel(filteredUsers);

    // Handlers de exportación con feedback
    const handleExportExcel = () => {
        const result = exportExcel();
        if (result.success) {
            pushNotification.success(
                t("Exportación exitosa"),
                t("El archivo Excel se ha descargado correctamente")
            );
        } else {
            pushNotification.error(
                t("Error al exportar"),
                t("No se pudo generar el archivo Excel")
            );
        }
    };

    const handleExportPDF = () => {
        const result = exportPDF();
        if (result.success) {
            pushNotification.success(
                t("Exportación exitosa"),
                t("El archivo PDF se está generando")
            );
        } else {
            pushNotification.error(
                t("Error al exportar"),
                t("No se pudo generar el archivo PDF")
            );
        }
    };

    // Exponer métodos de exportación al componente padre
    useImperativeHandle(ref, () => ({
        exportExcel: handleExportExcel,
        exportPDF: handleExportPDF,
    }));

    // Handlers para modo de exportación
    const handleToggleExportMode = () => {
        setIsExportMode(!isExportMode);
        setSelectedUsers(new Set()); // Limpiar selección al cambiar modo
    };

    const handleToggleSelectUser = (userId) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedUsers.size === filteredUsers.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
        }
    };

    const handleOpenExportModal = () => {
        if (selectedUsers.size === 0) {
            pushNotification.warning(
                t("Sin selección"),
                t("Debes seleccionar al menos un usuario para exportar")
            );
            return;
        }
        setShowExportModal(true);
    };

    const handleCloseExportModal = () => {
        setShowExportModal(false);
    };

    const handleExportSelected = (format, exportType) => {
        // IMPORTANTE: Usar todos los usuarios, no solo los filtrados
        // Los usuarios seleccionados pueden estar en cualquier parte de la lista original
        const usersToExport = usersData.filter(u => selectedUsers.has(u.id));
        
        if (usersToExport.length === 0) {
            pushNotification.warning(
                t("Sin selección"),
                t("No hay usuarios seleccionados para exportar")
            );
            return;
        }
        
        // Para AMBAS exportaciones en PDF, necesitamos expandir y recalcular porcentajes correctamente
        let finalUsersToExport = usersToExport;
        
        if (format === "pdf") {
            // Expandir todos los registros de asistencia de los usuarios seleccionados
            const expandedUsers = [];
            const students = appData.students || [];
            const courses = appData.courses || [];
            const environments = appData.environments || [];
            
            // Obtener IDs únicos de estudiantes seleccionados
            const selectedStudentIds = new Set(usersToExport.map(u => u.studentId || u.id));
            
            selectedStudentIds.forEach(studentId => {
                const student = students.find(s => s.id === studentId);
                if (!student || !student.attendanceHistory) return;
                
                // Obtener información del curso y ambiente
                const studentCourse = courses.find(c => c.code === student.course || c.id === student.course);
                let environmentName = t("Sin ambiente");
                let scheduledStartTime = null;
                let scheduledEndTime = null;
                let instructorName = null;
                let instructorId = null;
                
                if (studentCourse?.room) {
                    const environment = environments.find(env => env.id === studentCourse.room);
                    if (environment?.number) {
                        environmentName = environment.number;
                    }
                    
                    if (environment?.schedules && environment.schedules.length > 0) {
                        const courseSchedule = environment.schedules.find(
                            sch => sch.courseCode === student.course
                        );
                        if (courseSchedule) {
                            scheduledStartTime = courseSchedule.startTime;
                            scheduledEndTime = courseSchedule.endTime;
                            instructorName = courseSchedule.instructorName || null;
                            instructorId = courseSchedule.instructor || null;
                        } else if (environment.schedules[0]) {
                            scheduledStartTime = environment.schedules[0].startTime;
                            scheduledEndTime = environment.schedules[0].endTime;
                            instructorName = environment.schedules[0].instructorName || null;
                            instructorId = environment.schedules[0].instructor || null;
                        }
                    }
                }
                
                const fichaName = studentCourse?.name || student.courseName || student.course || t("Sin ficha");
                
                // Filtrar historial según rango de fechas si existe
                let historyToExport = student.attendanceHistory;
                
                if (dateRange.start && dateRange.end) {
                    historyToExport = historyToExport.filter(record => {
                        if (!record.date) return false;
                        
                        const recordDate = new Date(record.date);
                        recordDate.setHours(0, 0, 0, 0);
                        
                        const startDate = new Date(dateRange.start);
                        startDate.setHours(0, 0, 0, 0);
                        
                        const endDate = new Date(dateRange.end);
                        endDate.setHours(23, 59, 59, 999);
                        
                        return recordDate >= startDate && recordDate <= endDate;
                    });
                }
                
                // Ordenar por fecha ascendente para calcular porcentajes acumulados correctamente
                const sortedHistory = [...historyToExport].sort((a, b) => new Date(a.date) - new Date(b.date));
                
                // Crear un registro por cada fecha de asistencia con porcentaje acumulado
                sortedHistory.forEach((record, index) => {
                    // Calcular porcentaje acumulado hasta esta fecha
                    const recordsUpToNow = sortedHistory.slice(0, index + 1);
                    const presentsUpToNow = recordsUpToNow.filter(r => r.present).length;
                    const totalUpToNow = recordsUpToNow.length;
                    // Usar el mismo redondeo que attendanceUtils.js: redondear a 1 decimal
                    const rawPercentage = totalUpToNow > 0 ? (presentsUpToNow / totalUpToNow) * 100 : 0;
                    const attendanceUpToNow = Math.round(rawPercentage * 10) / 10;
                    
                    expandedUsers.push({
                        id: `${student.id}-${record.date}`,
                        studentId: student.id,
                        studentName: student.name,
                        studentCode: student.code,
                        ficha: student.course,
                        fichaName: fichaName,
                        environment: environmentName,
                        date: record.date,
                        scheduledStartTime,
                        scheduledEndTime,
                        actualCheckInTime: record.checkInTime || null,
                        actualCheckOutTime: record.checkOutTime || null,
                        instructorName,
                        instructorId,
                        status: record.present ? "present" : "absent",
                        late: record.late || false,
                        totalRecords: totalUpToNow, // Total acumulado hasta esta fecha
                        attendance: attendanceUpToNow, // Porcentaje acumulado hasta esta fecha
                    });
                });
            });
            
            // Ordenar por fecha descendente (más reciente primero)
            expandedUsers.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Para exportación DETALLADA: usar todos los registros expandidos
            // Para exportación SENCILLA: usar solo el registro más reciente por estudiante (primer registro de cada estudiante después de ordenar)
            if (exportType === "simple") {
                // Agrupar por estudiante y tomar solo el registro más reciente (el primero de cada grupo)
                const latestByStudent = new Map();
                expandedUsers.forEach(record => {
                    if (!latestByStudent.has(record.studentId)) {
                        latestByStudent.set(record.studentId, record);
                    }
                });
                finalUsersToExport = Array.from(latestByStudent.values());
            } else {
                // Exportación detallada: todos los registros
                finalUsersToExport = expandedUsers;
            }
        }
        
        // TODO: Implementar lógica según exportType ("simple" o "detailed")
        console.log(`[HistoricalSection] Exportando ${finalUsersToExport.length} usuarios en formato ${format} con tipo ${exportType}`);
        
        if (format === "excel") {
            // Construir filas de Excel con usuarios seleccionados
            const rows = usersToExport.map(user => ({
                [t("Código")]: user.studentCode,
                [t("Nombre")]: user.studentName,
                [t("Ficha")]: user.fichaName || user.ficha,
                [t("Ambiente")]: user.environment,
                [t("Fecha")]: user.date ? formatDate(user.date, "DD/MM/YYYY") : t("Sin registro"),
                [t("Estado")]: user.late ? t("Retardo") : (user.status === "present" ? t("Presente") : t("Ausente")),
                [t("Horario Programado")]: user.scheduledStartTime && user.scheduledEndTime 
                    ? `${user.scheduledStartTime} - ${user.scheduledEndTime}` 
                    : t("N/A"),
                [t("Registro Real")]: user.actualCheckInTime && user.actualCheckOutTime 
                    ? `${user.actualCheckInTime} - ${user.actualCheckOutTime}` 
                    : t("N/A"),
                [t("Total de Registros")]: user.totalRecords,
                [t("Asistencia (%)")]: user.attendance || 0,
            }));

            const sheets = [{
                name: t("Históricos de Asistencia"),
                data: rows,
                columns: [
                    { wch: 12 },  // Código
                    { wch: 32 },  // Nombre
                    { wch: 16 },  // Ficha
                    { wch: 14 },  // Ambiente
                    { wch: 14 },  // Fecha
                    { wch: 12 },  // Estado
                    { wch: 20 },  // Horario Programado
                    { wch: 20 },  // Registro Real
                    { wch: 14 },  // Total Registros
                    { wch: 14 },  // Asistencia (%)
                ],
            }];

            const filename = `Historicos_Seleccionados_${formatDate(new Date(), "YYYY-MM-DD")}.xlsx`;
            const result = exportToExcel(sheets, filename);

            if (result.success) {
                pushNotification.success(
                    t("Exportación exitosa"),
                    `${usersToExport.length} ${usersToExport.length === 1 ? t("registro exportado") : t("registros exportados")} a Excel`
                );
            } else {
                pushNotification.error(
                    t("Error al exportar"),
                    t("No se pudo generar el archivo Excel")
                );
            }
        } else if (format === "pdf") {
            // Obtener umbrales de asistencia desde la función centralizada
            const thresholds = getAttendanceThresholds();
            const minAttendance = thresholds.minAttendance;
            const warning = thresholds.warning;
            const excellent = thresholds.excellent;
            
            // Obtener colores del tema para consistencia
            const successColor = c.status.success;
            const warningColor = c.status.warning;
            const dangerColor = c.status.danger;
            
            // Calcular usuarios únicos
            const uniqueUsers = new Set(finalUsersToExport.map(u => u.studentId || u.id)).size;
            
            // Obtener rol del usuario (para usuario único)
            let userRole = null;
            if (uniqueUsers === 1 && finalUsersToExport.length > 0) {
                // Por ahora, todos los usuarios en históricos son estudiantes
                userRole = t("Estudiante");
            }
            
            // Determinar estado para usuario único
            let userStatus = null;
            if (uniqueUsers === 1 && finalUsersToExport.length > 0) {
                const attendance = finalUsersToExport[0].attendance || 0;
                
                // Lógica de estado:
                // 1. EXCELENTE: Si el porcentaje es exactamente igual al configurado en settings
                // 2. BUENO: >= excellent (threshold.excellent)
                // 3. REGULAR: >= warning pero < excellent
                // 4. EN RIESGO: < warning
                
                if (attendance === minAttendance) {
                    userStatus = {
                        label: t("Excelente"),
                        color: successColor,
                        icon: "⭐",
                    };
                } else if (attendance >= excellent) {
                    userStatus = {
                        label: t("Bueno"),
                        color: successColor,
                        icon: "✓",
                    };
                } else if (attendance >= warning) {
                    userStatus = {
                        label: t("Regular"),
                        color: warningColor,
                        icon: "⚠",
                    };
                } else {
                    userStatus = {
                        label: t("En riesgo"),
                        color: dangerColor,
                        icon: "⚠",
                    };
                }
            }
            
            // Determinar columnas según el tipo de exportación
            let columns;
            
            if (exportType === "simple") {
                // Exportación SENCILLA: Solo nombre, ficha y asistencia con progressbar
                columns = [
                    { key: "studentName", label: t("Nombre"), width: "40%" },
                    { key: "fichaName", label: t("Ficha"), width: "30%", align: "center" },
                    {
                        key: "attendance",
                        label: t("Asistencia"),
                        width: "30%",
                        align: "center",
                        render: (value) => {
                            const percentage = value || 0;
                            // Determinar color según umbrales del tema
                            let barColor = successColor; // Verde por defecto (>= excellent)
                            if (percentage < warning) {
                                barColor = dangerColor; // Rojo
                            } else if (percentage < excellent) {
                                barColor = warningColor; // Amarillo
                            }
                            
                            return `
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="flex: 1; height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden;">
                                        <div style="height: 100%; background: ${barColor}; width: ${percentage}%; transition: width 0.3s;"></div>
                                    </div>
                                    <strong style="color: ${barColor}; font-size: 14px; min-width: 45px; text-align: right;">${Math.round(percentage)}%</strong>
                                </div>
                            `;
                        },
                    },
                ];
            } else {
                // Exportación DETALLADA: Todos los campos
                columns = [
                    { key: "studentName", label: t("Nombre"), width: "25%" },
                    { key: "fichaName", label: t("Curso"), width: "20%" },
                    { key: "environment", label: t("Ambiente"), width: "15%" },
                    { 
                        key: "date", 
                        label: t("Fecha"), 
                        width: "15%",
                        render: (value) => value ? formatDate(value, "DD/MM/YYYY") : t("Sin registro")
                    },
                    {
                        key: "status",
                        label: t("Estado"),
                        width: "10%",
                        align: "center",
                        render: (value, row) => {
                            const status = row.late ? "late" : (value === "present" ? "present" : "absent");
                            return formatStatusBadge(status, {
                                present: { text: t("Presente"), color: c.status.success },
                                late: { text: t("Retardo"), color: c.status.warning },
                                absent: { text: t("Ausente"), color: c.status.danger },
                            });
                        },
                    },
                    {
                        key: "attendance",
                        label: t("Asistencia"),
                        width: "15%",
                        align: "center",
                        render: (value) => {
                            const percentage = value || 0;
                            // Determinar color según umbrales del tema
                            let barColor = successColor; // Verde por defecto (>= excellent)
                            if (percentage < warning) {
                                barColor = dangerColor; // Rojo
                            } else if (percentage < excellent) {
                                barColor = warningColor; // Amarillo
                            }
                            
                            return `
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="flex: 1; height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden;">
                                        <div style="height: 100%; background: ${barColor}; width: ${percentage}%; transition: width 0.3s;"></div>
                                    </div>
                                    <strong style="color: ${barColor}; font-size: 14px; min-width: 45px; text-align: right;">${Math.round(percentage)}%</strong>
                                </div>
                            `;
                        },
                    },
                ];
            }
            
            // Construir tabla HTML con las columnas según el tipo
            const historicosTable = buildHTMLTable(finalUsersToExport, columns);

            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${t("Históricos de Asistencia Seleccionados")}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            padding: 40px;
            background: #ffffff;
            color: #1a1a1a;
            position: relative;
        }
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            width: 600px;
            height: 700px;
            opacity: 0.12;
            z-index: 0;
            pointer-events: none;
        }
        .watermark-text {
            position: fixed;
            top: 55%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 72px;
            font-weight: 900;
            color: ${c.brand.primary};
            opacity: 0.15;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
            letter-spacing: 4px;
            text-align: center;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid ${c.brand.primary};
            position: relative;
            z-index: 1;
        }
        .header h1 {
            font-size: 32px;
            font-weight: 700;
            color: ${c.brand.primary};
            margin-bottom: 8px;
        }
        .header p {
            font-size: 14px;
            color: #666;
            margin-top: 4px;
        }
        .summary {
            display: flex;
            justify-content: space-around;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            position: relative;
            z-index: 1;
        }
        .summary-item {
            text-align: center;
        }
        .summary-item .value {
            font-size: 36px;
            font-weight: 700;
            color: ${c.brand.primary};
            margin-bottom: 4px;
        }
        .summary-item .label {
            font-size: 14px;
            color: #666;
            font-weight: 500;
        }
        .summary-item.status .value {
            color: ${userStatus?.color || c.brand.primary};
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            position: relative;
            z-index: 1;
            background: #ffffff;
        }
        thead {
            background: ${c.brand.primary};
            color: white;
        }
        th {
            padding: 14px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 13px;
        }
        tbody tr:hover {
            background-color: #f8f9fa;
        }
        tbody tr:last-child td {
            border-bottom: none;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 12px;
            position: relative;
            z-index: 1;
        }
        @media print {
            body {
                padding: 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .summary-item .value {
                font-size: 28px;
            }
        }
    </style>
</head>
<body>
    <!-- Marca de agua con logo SVG -->
    <div class="watermark">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 610" width="100%" height="100%">
            <g opacity="1">
                <path d="M0 0 C21.345174 17.620184 31.405386 37.7886 38.589844 64.371094 C38.847656 65.299219 38.847656 65.299219 40.152344 69.996094 C41.334523 75.238803 42.103626 80.241342 42.777344 85.558594 C44.536137 97.983011 48.591156 109.520143 52.589844 121.371094 C56.534444 133.59757 57.662133 142.608042 49.589844 153.371094 C48.929844 153.371094 48.269844 153.371094 47.589844 153.371094 C46.929844 155.021094 46.269844 156.671094 45.589844 158.371094 C44.929844 158.371094 44.269844 158.371094 43.589844 158.371094 C43.259844 159.691094 42.929844 161.011094 42.589844 162.371094 C42.259844 163.031094 41.929844 163.691094 41.589844 164.371094 C41.085032 172.826682 42.409097 178.190347 48.589844 184.371094 C65.360928 208.828925 65.360928 208.828925 59.589844 220.371094 C58.929844 220.371094 58.269844 220.371094 57.589844 220.371094 C57.589844 221.361094 57.589844 222.351094 57.589844 223.371094 C51.589844 227.371094 51.589844 227.371094 49.589844 227.371094 C46.329939 233.890902 45.589844 237.951751 45.589844 245.371094 C44.154279 252.907808 42.494747 258.820933 38.589844 265.371094 C36.527787 272.146424 36.814389 277.392001 37.589844 284.371094 C37.317248 289.754859 36.577448 294.416365 35.152344 299.621094 C33.589844 305.371094 33.589844 305.371094 32.652344 312.683594 C31.195234 321.854815 27.594366 326.888561 19.589844 331.371094 C9.316928 332.304995 0.714126 330.645031 -9.257812 328.28125 C-33.670422 322.930227 -54.958104 339.87071 -67.410156 359.371094 C-68.853906 361.495469 -70.297656 363.619844 -71.785156 365.808594 C-76.439879 373.05016 -80.015472 380.679481 -83.5625 388.511719 C-86.367646 394.371094 -86.367646 394.371094 -93.410156 394.371094 C-95.410156 393.371094 -95.410156 393.371094 -95.910156 388.433594 C-98.062152 381.170609 -100.042439 382.219243 -107.410156 381.371094 C-116.016911 381.005496 -124.626851 380.956607 -133.240234 380.892578 C-134.983691 380.866152 -136.727148 380.839727 -138.523438 380.8125 C-140.109387 380.799045 -141.695337 380.785591 -143.329346 380.771729 C-149.194396 380.195926 -151.768065 378.655275 -154.410156 373.371094 C-154.447524 371.986016 -154.484892 370.600939 -154.523392 369.173889 C-155.410156 365.371094 -155.410156 365.371094 -158.86882 364.435974 C-160.429578 364.465804 -161.990335 364.495634 -163.598389 364.526367 C-165.360794 364.539882 -167.123199 364.553397 -168.939011 364.567322 C-169.900402 364.594241 -169.900402 364.594241 -174.765625 364.730469 C-176.725428 364.751275 -178.685231 364.772081 -180.704422 364.793518 C-187.00334 364.865118 -193.299721 364.989782 -199.597656 365.121094 C-205.877499 365.231464 -212.156971 365.330374 -218.437332 365.405823 C-222.354082 365.454933 -226.270631 365.525429 -230.186569 365.61908 C-231.075652 365.632141 -231.075652 365.632141 -235.574951 365.698242 C-237.139687 365.731254 -238.704422 365.764266 -240.316574 365.798279 C-247.129658 365.087301 -249.918816 362.599444 -252.410156 356.371094 C-252.410156 348.371094 -252.410156 348.371094 -251.410156 346.371094 C-257.993343 346.255287 -264.576268 346.183969 -271.160156 346.121094 C-272.097305 346.104336 -272.097305 346.104336 -276.839844 346.019531 C-277.735742 346.013086 -277.735742 346.013086 -282.269531 345.980469 C-283.096948 345.969995 -283.096948 345.969995 -287.28418 345.916992 C-291.410156 346.371094 -291.410156 346.371094 -295.410156 350.371094 C-296.371988 370.409262 -296.371988 370.409262 -291.410156 375.371094 C-285.24948 376.397873 -279.580005 376.51465 -273.335938 376.546875 C-272.156768 376.558799 -272.156768 376.558799 -266.189453 376.619141 C-261.199958 376.66221 -256.210346 376.693405 -251.220703 376.712891 C-250.043467 376.726748 -250.043467 376.726748 -244.085938 376.796875 C-241.919426 376.811458 -239.752915 376.82604 -237.520752 376.841064 C-232.410156 377.371094 -232.410156 377.371094 -229.410156 381.371094 C-229.410156 389.371094 -229.410156 389.371094 -232.410156 394.371094 C-241.38747 397.363532 -251.404087 394.08434 -260.410156 392.308594 C-262.014717 391.993499 -263.619277 391.678403 -265.272461 391.35376 C-332.776942 377.738529 -365.130864 348.552866 -379.792969 281.683594 C-382.573457 269.110953 -385.751553 257.011845 -390.222656 244.933594 C-396.488466 227.315287 -392.684639 217.852903 -380.410156 204.371094 C-374.965991 190.760681 -385.870559 175.910691 -395.410156 166.371094 C-400.779438 155.63253 -400.205336 149.508786 -391.910156 140.621094 C-390.755156 139.548594 -389.600156 138.476094 -388.410156 137.371094 C-383.743593 132.704531 -383.361806 132.160042 -383.535156 125.746094 C-383.347008 117.65573 -381.460665 112.856296 -376.785156 106.246094 C-372.97818 100.747129 -371.401018 97.047504 -373.847656 90.558594 C-377.420859 80.982409 -374.595994 73.09219 -371.632812 63.773438 C-370.456904 59.539416 -369.883715 55.611966 -369.472656 51.246094 C-368.074214 42.197351 -365.858875 38.750581 -357.410156 35.371094 C-347.747974 34.64643 -338.948926 36.474856 -329.558594 38.496094 C-301.302643 43.298319 -279.315395 22.732624 -265.816406 0.003906 C-262.563103 -5.806963 -259.408717 -11.655098 -256.402344 -17.597656 C-251.883599 -26.439529 -251.883599 -26.439529 -246.410156 -28.628906 C-243.410156 -26.628906 -243.410156 -26.628906 -242.910156 -21.566406 C-241.410156 -16.628906 -241.410156 -16.628906 -236.957031 -15.8125 C-227.062034 -15.535015 -217.181346 -15.661368 -207.285156 -15.84375 C-205.733125 -15.85793 -204.181094 -15.872109 -202.582031 -15.886719 C-201.881265 -15.897756 -201.881265 -15.897756 -198.334961 -15.953613 C-193.322376 -15.538912 -189.060383 -14.279133 -185.410156 -10.628906 C-185.327656 -9.123281 -185.245156 -7.617656 -185.160156 -6.066406 C-184.912656 -4.602031 -184.665156 -3.137656 -184.410156 -1.628906 C-178.410156 -0.628906 -178.410156 -0.628906 -176.410156 -1.628906 C-170.831782 -1.742199 -165.266291 -1.793103 -159.6875 -1.796875 C-158.002579 -1.800203 -156.317659 -1.803532 -154.58168 -1.806961 C-151.006361 -1.812035 -147.431036 -1.814369 -143.855713 -1.814209 C-138.395265 -1.816387 -132.935021 -1.834516 -127.474609 -1.853516 C-124.003907 -1.856451 -120.533204 -1.858435 -117.0625 -1.859375 C-116.246722 -1.862968 -116.246722 -1.862968 -112.118393 -1.881149 C-92.179969 -1.841172 -92.179969 -1.841172 -86.410156 5.371094 C-85.701986 9.029971 -85.030014 12.696224 -84.410156 16.371094 C-83.750156 16.371094 -83.090156 16.371094 -82.410156 16.371094 C-82.410156 17.031094 -82.410156 17.691094 -82.410156 18.371094 C-77.154465 18.43427 -71.971443 18.361328 -66.722656 18.183594 C-65.238301 18.152012 -63.753945 18.12043 -62.224609 18.087891 C-47.031919 17.614619 -47.031919 17.614619 -44.410156 12.371094 C-43.184744 5.09633 -42.548751 -1.430266 -44.410156 -8.628906 C-51.928457 -10.383176 -56.76648 -10.133995 -64.410156 -9.628906 C-71.413355 -9.589083 -78.408696 -9.735485 -85.410156 -9.878906 C-87.203887 -9.882451 -88.997617 -9.885996 -90.845703 -9.889648 C-92.537598 -9.911885 -94.229492 -9.934121 -95.972656 -9.957031 C-96.736426 -9.961704 -96.736426 -9.961704 -100.601562 -9.985352 C-104.410156 -10.628906 -104.410156 -10.628906 -108.410156 -15.628906 C-108.410156 -50.996887 -15.985306 -12.323151 0 0 Z M-259.410156 6.371094 C-261.943169 13.970133 -263.572207 25.209043 -257.410156 31.371094 C-254.562655 31.627573 -251.705137 31.77702 -248.847656 31.871094 C-232.139844 32.641406 -232.139844 32.641406 -227.410156 37.371094 C-223.003806 37.664975 -218.58409 37.764648 -214.167969 37.777344 C-212.852309 37.78818 -211.53665 37.799016 -210.181122 37.810181 C-205.96575 37.844539 -201.75065 37.860055 -197.535156 37.871094 C-191.995832 37.885636 -186.457116 37.919288 -180.917969 37.964844 C-179.683772 37.968389 -179.683772 37.968389 -173.437988 37.986328 C-165.867667 38.469553 -163.279137 39.198642 -160.410156 46.371094 C-159.505808 63.101529 -159.505808 63.101529 -167.410156 68.371094 C-173.589249 68.596277 -179.721904 68.699416 -185.902344 68.707031 C-186.826526 68.71036 -186.826526 68.71036 -191.503448 68.727203 C-195.419118 68.737345 -199.334805 68.74202 -203.250488 68.741699 C-209.253218 68.74607 -215.255213 68.782374 -221.257812 68.820312 C-225.055987 68.826181 -228.854165 68.83015 -232.652344 68.832031 C-234.454524 68.846402 -236.256703 68.860773 -238.113495 68.87558 C-239.785177 68.869427 -241.45686 68.863273 -243.179199 68.856934 C-244.651299 68.859784 -246.123398 68.862634 -247.640106 68.86557 C-251.410156 68.371094 -251.410156 68.371094 -256.410156 64.371094 C-257.160156 59.933594 -257.160156 59.933594 -257.410156 55.371094 C-257.740156 53.721094 -258.070156 52.071094 -258.410156 50.371094 C-263.333896 49.909683 -267.866872 49.768629 -272.785156 49.871094 C-273.461914 49.869805 -273.461914 49.869805 -276.886719 49.863281 C-287.003105 49.964042 -287.003105 49.964042 -290.410156 53.371094 C-290.878906 58.300781 -290.878906 58.300781 -290.910156 64.246094 C-290.941094 66.202891 -290.972031 68.159688 -291.003906 70.175781 C-290.410156 75.371094 -290.410156 75.371094 -285.410156 80.371094 C-280.024902 81.014648 -280.024902 81.014648 -273.433594 81.042969 C-272.252813 81.055215 -272.252813 81.055215 -266.277344 81.117188 C-263.804922 81.118477 -261.3325 81.119766 -258.785156 81.121094 C-253.897111 81.154121 -249.009086 81.190403 -244.121094 81.230469 C-243.034656 81.232886 -243.034656 81.232886 -237.536621 81.245117 C-232.410156 81.371094 -232.410156 81.371094 -229.410156 82.371094 C-234.173301 85.572552 -238.945436 88.697184 -243.847656 91.683594 C-249.594734 95.493454 -254.410418 99.631082 -259.410156 104.371094 C-260.730156 105.587969 -262.050156 106.804844 -263.410156 108.058594 C-295.265981 142.403155 -299.522034 190.007245 -278.597656 230.996094 C-269.293582 248.041991 -255.085921 261.150555 -238.660156 271.308594 C-235.410156 273.371094 -235.410156 273.371094 -235.410156 275.371094 C-239.4086 275.722605 -243.408824 276.054157 -247.410156 276.371094 C-255.894182 279.764704 -254.72926 283.762072 -254.785156 292.308594 C-254.799336 293.292793 -254.799336 293.292793 -254.871094 298.273438 C-254.410156 303.371094 -254.410156 303.371094 -250.410156 307.371094 C-244.012273 307.813599 -237.725146 307.877448 -231.318359 307.859375 C-220.909975 307.971238 -220.909975 307.971238 -215.410156 312.371094 C-213.321609 318.636737 -213.99971 324.344978 -216.410156 330.371094 C-216.410156 331.361094 -216.410156 332.351094 -216.410156 333.371094 C-212.270264 333.787598 -212.270264 333.787598 -206.515625 333.847656 C-204.444746 333.878594 -202.373867 333.909531 -200.240234 333.941406 C-198.048184 333.959453 -195.856133 333.9775 -193.597656 333.996094 C-189.320271 334.047397 -185.042923 334.10198 -180.765625 334.160156 C-178.854187 334.17772 -176.942749 334.195283 -174.973389 334.213379 C-158.973456 334.666969 -158.973456 334.666969 -154.410156 340.371094 C-153.941406 344.21875 -153.941406 344.21875 -153.910156 348.433594 C-153.410156 356.371094 -153.410156 356.371094 -149.410156 360.371094 C-147.100156 359.711094 -144.790156 359.051094 -142.410156 358.371094 C-134.076878 358.08213 -125.745093 358.373633 -117.410156 358.558594 C-115.115625 358.590176 -112.821094 358.621758 -110.457031 358.654297 C-108.255313 358.69877 -106.053594 358.743242 -103.785156 358.789062 C-101.771641 358.827976 -99.758125 358.86689 -97.683594 358.906982 C-92.410156 359.371094 -92.410156 359.371094 -85.410156 362.371094 C-84.420156 362.371094 -83.430156 362.371094 -82.410156 362.371094 C-82.410156 361.711094 -82.410156 361.051094 -82.410156 360.371094 C-81.750156 360.371094 -81.090156 360.371094 -80.410156 360.371094 C-76.493761 352.538303 -77.715108 343.456238 -80.410156 335.371094 C-86.067722 332.542311 -90.865439 333.256904 -97.160156 333.371094 C-101.242824 333.444821 -105.327946 333.466864 -109.410156 333.371094 C-109.410156 332.711094 -109.410156 332.051094 -109.410156 331.371094 C-115.701694 329.573511 -120.137963 329.082701 -126.585938 328.992188 C-128.548535 328.958027 -130.511133 328.923867 -132.533203 328.888672 C-134.575723 328.862246 -136.618242 328.83582 -138.722656 328.808594 C-142.760472 328.748366 -146.798237 328.684681 -150.835938 328.617188 C-152.62427 328.593259 -154.412603 328.569331 -156.255127 328.544678 C-174.894845 327.917027 -174.894845 327.917027 -177.410156 320.371094 C-178.765726 304.520168 -178.765726 304.520168 -174.847656 298.308594 C-161.450353 292.459067 -143.134134 295.18494 -128.710938 295.185791 C-124.524639 295.183588 -120.338597 295.165335 -116.152344 295.146484 C-113.470053 295.143553 -110.787761 295.141566 -108.105469 295.140625 C-106.898987 295.138571 -106.898987 295.138571 -100.793457 295.128174 C-93.136396 295.419567 -87.596726 295.731166 -81.410156 300.371094 C-80.636617 304.686631 -79.964458 309.021959 -79.410156 313.371094 C-75.339953 317.441297 -60.617171 315.535094 -55.410156 315.371094 C-47.144296 311.238164 -48.271261 309.042025 -48.285156 300.371094 C-48.282578 298.762344 -48.28 297.153594 -48.277344 295.496094 C-48.519588 287.972279 -48.661139 288.692101 -56.410156 285.371094 C-61.639404 285.046387 -61.639404 285.046387 -67.671875 285.113281 C-68.756943 285.120371 -68.756943 285.120371 -74.248047 285.15625 C-75.378232 285.171074 -75.378232 285.171074 -81.097656 285.246094 C-85.580691 285.289334 -90.063766 285.328601 -94.546875 285.363281 C-96.534207 285.387612 -98.521538 285.411943 -100.569092 285.437012 C-105.410156 285.371094 -105.410156 285.371094 -109.410156 284.371094 C-109.740156 283.381094 -110.070156 282.391094 -110.410156 281.371094 C-108.760156 280.711094 -107.110156 280.051094 -105.410156 279.371094 C-97.758868 274.931458 -91.088515 270.143912 -84.410156 264.371094 C-83.172656 263.360469 -81.935156 262.349844 -80.660156 261.308594 C-77.410156 258.371094 -77.410156 258.371094 -74.410156 253.371094 C-72.760156 251.721094 -71.110156 250.071094 -69.410156 248.371094 C-68.420156 246.391094 -67.430156 244.411094 -66.410156 242.371094 C-65.420156 241.711094 -64.430156 241.051094 -63.410156 240.371094 C-63.410156 239.051094 -63.410156 237.731094 -63.410156 236.371094 C-62.420156 236.041094 -61.430156 235.711094 -60.410156 235.371094 C-58.658595 232.081577 -56.995051 228.744074 -55.410156 225.371094 C-54.750156 224.051094 -54.090156 222.731094 -53.410156 221.371094 C-53.080156 219.308594 -52.750156 217.246094 -52.410156 215.121094 C-52.080156 213.223594 -51.750156 211.326094 -51.410156 209.371094 C-50.750156 209.371094 -50.090156 209.371094 -49.410156 209.371094 C-45.324454 186.445766 -47.213495 165.829971 -56.410156 144.371094 C-56.843281 143.071719 -57.276406 141.772344 -57.722656 140.433594 C-59.668618 135.74887 -62.240589 132.316881 -65.410156 128.371094 C-67.492473 125.768198 -69.561156 123.144595 -71.410156 120.371094 C-75.410156 115.371094 -75.410156 115.371094 -80.410156 110.371094 C-81.730156 109.051094 -83.050156 107.731094 -84.410156 106.371094 C-86.614374 104.793961 -88.845629 103.25417 -91.097656 101.746094 C-97.410156 97.371094 -97.410156 97.371094 -98.410156 95.371094 C-99.400156 95.371094 -100.390156 95.371094 -101.410156 95.371094 C-101.410156 94.711094 -101.410156 94.051094 -101.410156 93.371094 C-102.400156 93.041094 -103.390156 92.711094 -104.410156 92.371094 C-104.740156 91.381094 -105.070156 90.391094 -105.410156 89.371094 C-103.203281 89.267969 -100.996406 89.164844 -98.722656 89.058594 C-87.461666 87.999868 -87.461666 87.999868 -84.410156 80.371094 C-84.224034 77.521783 -84.150233 74.663959 -84.160156 71.808594 C-84.155 70.322305 -84.149844 68.836016 -84.144531 67.304688 C-84.460777 62.62146 -84.685752 59.945895 -89.410156 58.371094 C-96.2465 58.170462 -103.079301 58.024371 -109.917969 57.941406 C-121.083002 57.698248 -121.083002 57.698248 -124.410156 54.371094 C-125.212496 48.620995 -125.551826 44.079443 -124.410156 38.371094 C-124.410156 36.721094 -124.410156 35.071094 -124.410156 33.371094 C-128.673584 32.743408 -128.673584 32.743408 -134.59375 32.734375 C-136.71877 32.714395 -138.843789 32.694414 -141.033203 32.673828 C-142.157588 32.675439 -142.157588 32.675439 -147.847656 32.683594 C-152.242226 32.666962 -156.636774 32.642516 -161.03125 32.609375 C-162.013153 32.609576 -162.013153 32.609576 -166.982178 32.610596 C-172.067515 32.386212 -176.529078 31.801229 -181.410156 30.371094 C-181.410156 29.711094 -181.410156 29.051094 -181.410156 28.371094 C-182.070156 28.371094 -182.730156 28.371094 -183.410156 28.371094 C-184.360749 23.618132 -184.351349 19.868842 -184.160156 15.058594 C-184.242656 12.521719 -184.325156 9.984844 -184.410156 7.371094 C-186.060156 7.371094 -187.710156 7.371094 -189.410156 7.371094 C-189.740156 7.206094 -189.740156 7.206094 -191.410156 6.371094 C-195.207994 6.320222 -199.006756 6.335649 -202.804688 6.378906 C-203.963232 6.387285 -203.963232 6.387285 -209.826172 6.429688 C-214.74552 6.473854 -219.664804 6.5259 -224.583984 6.585938 C-225.744463 6.593027 -225.744463 6.593027 -231.617188 6.628906 C-233.75679 6.650981 -235.896392 6.673057 -238.10083 6.695801 C-243.086343 6.390897 -245.664902 6.116348 -249.410156 2.371094 C-254.410156 2.371094 -254.410156 2.371094 -259.410156 6.371094 Z " fill="${c.brand.primary}" transform="translate(475.41015625,123.62890625)"/>
                <path d="M0 0 C0.20625 1.670625 0.4125 3.34125 0.625 5.0625 C2 10 2 10 6.445312 10.816406 C16.342936 11.093634 26.22619 10.967586 36.125 10.785156 C37.677031 10.770977 39.229062 10.756797 40.828125 10.742188 C41.528892 10.73115 41.528892 10.73115 45.075195 10.675293 C50.087781 11.089994 54.349773 12.349773 58 16 C59.659381 24.296906 58.853008 28.517593 52 34 C46.738281 34.501709 46.738281 34.501709 40.3125 34.496094 C38.005078 34.496738 35.697656 34.497383 33.320312 34.498047 C30.904609 34.478066 28.488906 34.458086 26 34.4375 C24.792148 34.441045 24.792148 34.441045 18.679688 34.458984 C-1.61471 34.38529 -1.61471 34.38529 -6 30 C-13 31 -13 31 -16 36 C-17.991935 53.008065 -17.991935 53.008065 -14 57 C-11.169108 57.187338 -8.334813 57.324015 -5.5 57.4375 C11.300781 58.300781 11.300781 58.300781 16 63 C20.40635 63.293881 24.826067 63.393554 29.242188 63.40625 C30.557847 63.417086 31.873506 63.427922 33.229034 63.439087 C37.444406 63.473445 41.659506 63.488961 45.875 63.5 C51.414325 63.514542 56.953041 63.548194 62.492188 63.59375 C63.726384 63.597295 63.726384 63.597295 69.972168 63.615234 C78.373138 64.151481 80.219259 65.438518 84 73 C84.647439 83.359021 84.801591 89.398807 76 96 C72.370392 96.394409 72.370392 96.394409 67.930176 96.419922 C66.268101 96.435834 64.606026 96.451746 62.893585 96.46814 C61.99462 96.46824 61.99462 96.46824 57.445312 96.46875 C55.600735 96.476364 53.756157 96.483977 51.855682 96.491821 C47.950189 96.502638 44.044666 96.505469 40.13916 96.500977 C34.156085 96.500005 28.174295 96.541602 22.191406 96.585938 C18.401044 96.591145 14.610678 96.593833 10.820312 96.59375 C9.026431 96.610145 7.232549 96.626541 5.384308 96.643433 C3.715929 96.634127 2.047549 96.624822 0.328613 96.615234 C-1.138249 96.617289 -2.605112 96.619343 -4.116425 96.62146 C-8 96 -8 96 -14 91 C-14.853004 86.552191 -15 82.516218 -15 78 C-19.875102 77.641804 -24.503115 77.538165 -29.375 77.625 C-30.058203 77.625645 -30.058203 77.625645 -33.515625 77.628906 C-43.719835 77.719835 -43.719835 77.719835 -46 80 C-46.249755 83.618546 -46.351417 87.247922 -46.375 90.875 C-46.403359 92.852422 -46.431719 94.829844 -46.460938 96.867188 C-46 102 -46 102 -42 106 C-36.744141 106.51416 -36.744141 106.51416 -30.15625 106.539062 C-27.795977 106.562266 -25.435703 106.585469 -23.003906 106.609375 C-20.527617 106.614531 -18.051328 106.619687 -15.5 106.625 C-10.614532 106.650432 -5.729097 106.683872 -0.84375 106.726562 C1.330254 106.732524 3.504258 106.738486 5.744141 106.744629 C11 107 11 107 15 109 C10.838605 112.329116 6.862078 114.963018 2.3125 117.6875 C-4.467758 121.886567 -10.261779 126.423419 -16 132 C-16.5775 132.525937 -16.5775 132.525937 -19.5 135.1875 C-50.990879 169.490065 -54.959912 216.933837 -34.1875 257.625 C-24.906811 274.642487 -10.919051 287.063191 5.3125 297.375 C6.529375 298.24125 7.74625 299.1075 9 300 C7.209411 305.371767 1.048361 303.646615 -4 304 C-12.022203 307.208881 -10.185857 310.67903 -10.25 318.9375 C-10.275781 320.926523 -10.301562 322.915547 -10.328125 324.964844 C-10 330 -10 330 -7 333 C-0.664412 333.320318 5.614169 333.387438 11.955078 333.351562 C20.08869 333.446832 22.513146 333.594288 29 339 C31.493993 346.48198 29.858009 352.937709 27 360 C27.683082 359.997382 27.683082 359.997382 31.139893 359.984131 C37.36409 359.96327 43.588281 359.950311 49.8125 359.9375 C51.962012 359.929121 54.111523 359.920742 56.326172 359.912109 C57.368701 359.910498 57.368701 359.910498 62.644531 359.902344 C63.60025 359.899725 63.60025 359.899725 68.436768 359.886475 C84.342545 360.211054 84.342545 360.211054 90 367 C90.449995 371.990853 90.787856 376.993394 91 382 C91.66 383.32 92.32 384.64 93 386 C93.33 386.99 93.66 387.98 94 389 C93.01 389.66 92.02 390.32 91 391 C91 399 91 399 94 405 C91 404 91 404 89 400 C88.962632 398.614922 88.925265 397.229845 88.886765 395.802795 C88 392 88 392 84.541336 391.06488 C82.980578 391.09471 81.419821 391.12454 79.811768 391.155273 C78.049362 391.168788 76.286957 391.182303 74.471146 391.196228 C73.509754 391.223147 73.509754 391.223147 68.644531 391.359375 C66.684728 391.380181 64.724925 391.400988 62.705734 391.422424 C56.406816 391.494024 50.110435 391.618688 43.8125 391.75 C37.532658 391.860371 31.253186 391.95928 24.972824 392.034729 C21.056075 392.08384 17.139525 392.154336 13.223587 392.247986 C12.334504 392.261048 12.334504 392.261048 7.835205 392.327148 C6.27047 392.360161 4.705734 392.393173 3.093582 392.427185 C-3.719502 391.716207 -6.50866 389.22835 -9 383 C-9 375 -9 375 -8 373 C-14.583186 372.884193 -21.166112 372.812875 -27.75 372.75 C-28.687148 372.733242 -28.687148 372.733242 -33.429688 372.648438 C-34.325586 372.641992 -34.325586 372.641992 -38.859375 372.609375 C-39.686792 372.598901 -39.686792 372.598901 -43.874023 372.545898 C-48 373 -48 373 -52 377 C-52.961832 397.038168 -52.961832 397.038168 -48 402 C-41.839324 403.026779 -36.169849 403.143556 -29.925781 403.175781 C-28.746611 403.187705 -28.746611 403.187705 -22.779297 403.248047 C-17.789802 403.291116 -12.80019 403.322311 -7.810547 403.341797 C-6.633311 403.355654 -6.633311 403.355654 -0.675781 403.425781 C1.49073 403.440364 3.657241 403.454946 5.889404 403.469971 C11 404 11 404 14 408 C14 416 14 416 11 421 C2.022686 423.992438 -7.99393 420.713246 -17 418.9375 C-18.604561 418.622405 -20.209121 418.30731 -21.862305 417.982666 C-89.366786 404.367436 -121.720708 375.181773 -136.382812 308.3125 C-139.1633 295.739859 -142.341397 283.640751 -146.8125 271.5625 C-153.07831 253.944193 -149.274483 244.481809 -137 231 C-131.555835 217.389587 -142.460403 202.539597 -152 193 C-157.369282 182.261437 -156.795179 176.137692 -148.5 167.25 C-147.345 166.1775 -146.19 165.105 -145 164 C-140.333437 159.333437 -139.95165 158.788949 -140.125 152.375 C-139.936852 144.284636 -138.050509 139.485202 -133.375 132.875 C-129.568024 127.376035 -127.990862 123.67641 -130.4375 117.1875 C-134.010703 107.611316 -131.185838 99.721096 -128.222656 90.402344 C-127.046748 86.168322 -126.473558 82.240872 -126.0625 77.875 C-124.664058 68.826258 -122.448719 65.379488 -114 62 C-104.337818 61.275336 -95.53877 63.103762 -86.148438 65.125 C-57.892487 69.927225 -35.905238 49.361531 -22.40625 26.632812 C-19.148709 20.814373 -16.014992 14.938406 -12.921875 9.03125 C-6.745705 -2.698282 -6.745705 -2.698282 0 0 Z " fill="${c.brand.secondary || '#46B5DF'}" transform="translate(232,97)"/>
            </g>
        </svg>
    </div>
    
    <!-- Texto de marca de agua -->
    <div class="watermark-text">FaceAttend EDU</div>
    
    <div class="header">
        <h1>${t("Históricos de Asistencia Seleccionados")}</h1>
        <p>${t("Registros seleccionados para exportación")} - ${exportType === "simple" ? t("Exportación sencilla") : t("Exportación detallada")}</p>
        ${dateRange.start && dateRange.end ? `
        <p><strong>${t("Rango de fechas")}:</strong> ${formatDate(dateRange.start, "DD/MM/YYYY")} - ${formatDate(dateRange.end, "DD/MM/YYYY")}</p>
        ` : `
        <p><strong>${t("Fecha de último registro mostrada")}</strong></p>
        `}
        <p>${t("Fecha de generación")}: ${formatDate(new Date(), "DD/MM/YYYY HH:mm")}</p>
    </div>

    <div class="summary">
        ${userStatus ? `
        <div class="summary-item status">
            <div class="value">${userStatus.label}</div>
            <div class="label">${userStatus.icon} ${t("Estado")}</div>
        </div>
        ` : `
        <div class="summary-item">
            <div class="value">${finalUsersToExport.length}</div>
            <div class="label">${finalUsersToExport.length === 1 ? t("Registro seleccionado") : t("Registros seleccionados")}</div>
        </div>
        `}
        <div class="summary-item">
            <div class="value">${uniqueUsers === 1 ? userRole : uniqueUsers}</div>
            <div class="label">${uniqueUsers === 1 ? t("Tipo de usuario") : t("Usuarios únicos")}</div>
        </div>
        <div class="summary-item">
            <div class="value">${exportType === "detailed" 
                ? finalUsersToExport.length 
                : finalUsersToExport.reduce((sum, u) => sum + (u.totalRecords || 0), 0)
            }</div>
            <div class="label">${t("Total de asistencias")}</div>
        </div>
    </div>

    ${historicosTable}

    <div class="footer">
        <p>FaceAttend EDU © ${new Date().getFullYear()}</p>
        <p>${t("Sistema de Control de Asistencia")}</p>
    </div>
</body>
</html>
            `;

            const result = exportToPDF(html, `Historicos_Seleccionados_${formatDate(new Date(), "YYYY-MM-DD")}`);

            if (result.success) {
                pushNotification.success(
                    t("Exportación exitosa"),
                    `${finalUsersToExport.length} ${finalUsersToExport.length === 1 ? t("registro exportado") : t("registros exportados")} a PDF`
                );
            } else {
                pushNotification.error(
                    t("Error al exportar"),
                    t("No se pudo generar el archivo PDF")
                );
            }
        }
        
        // Cerrar modal y resetear modo
        setShowExportModal(false);
        setIsExportMode(false);
        setSelectedUsers(new Set());
    };

    useEffect(() => {
        if (onStatsChange) {
            // Deduplicar estudiantes para cálculos precisos
            const allStudents = appData.students || [];
            const uniqueStudents = Array.from(
                new Map(allStudents.map(s => [s.id, s])).values()
            );
            
            // Calcular total de registros ÚNICOS (sin duplicar)
            // Si NO hay filtro de fechas, sumar totalRecords de cada usuario único
            // Si HAY filtro de fechas, contar los registros expandidos
            let totalRecords;
            let totalUsers;
            
            if (!dateRange.start || !dateRange.end) {
                // Sin filtro: sumar totalRecords de cada usuario único
                totalRecords = usersData.reduce((sum, user) => sum + user.totalRecords, 0);
                totalUsers = usersData.length;
            } else {
                // Con filtro: contar registros únicos por estudiante
                const uniqueStudentIds = new Set(usersData.map(u => u.studentId));
                totalUsers = uniqueStudentIds.size;
                
                // Total de registros = todos los registros de todos los estudiantes únicos
                totalRecords = uniqueStudents.reduce((sum, student) => {
                    return sum + (student.attendanceHistory?.length || 0);
                }, 0);
            }
            
            onStatsChange({
                totalRecords,
                totalUsers,
            });
        }
    }, [usersData, onStatsChange, dateRange.start, dateRange.end, appData.students]);

    const clearFilters = () => {
        setSearchValue({ searchType: "student", searchText: "" });
        setSelectedFicha("");
        setDateRange({ start: null, end: null });
    };

    const handleUserClick = (user) => {
        setSelectedUser(user);
        setShowHistoryModal(true);
    };

    const handleCloseHistoryModal = () => {
        setShowHistoryModal(false);
        setSelectedUser(null);
    };

    if (appData.isLoading) {
        return <Loader fullScreen message={t("Cargando históricos...")} />;
    }

    return (
        <View style={{ gap: 20, position: "relative" }}>
            {/* Panel de filtros */}
            {showFilters && (
                <View style={{
                    padding: 14, // Reducido de 20 a 16
                    backgroundColor: c.background.surface,
                    borderRadius: 12,
                    gap: 12, // Reducido de 16 a 12
                    borderWidth: 1,
                    borderColor: c.border.primary,
                    zIndex: 10,
                }}>
                    {/* Header: Título + Botones */}
                    <View style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "baseline", // Alinear por línea base del texto
                        marginTop: -8,
                        marginBottom: -12,
                    }}>
                        <Text style={{
                            fontSize: 15,
                            fontWeight: "600",
                            color: c.text.primary,
                            lineHeight: 20, // Altura de línea explícita
                        }}>
                            {t("Filtros de búsqueda")}
                        </Text>

                        <View style={{
                            flexDirection: "row",
                            gap: 12,
                            position: 'relative',
                            top: 4, // Mover visualmente hacia abajo sin cambiar altura
                        }}>
                            <Button variant="ghost" size="sm" onPress={clearFilters}>
                                {t("Limpiar")}
                            </Button>
                            <Button variant="primary" size="sm" onPress={() => onToggleFilters && onToggleFilters(false)}>
                                {t("Aplicar")}
                            </Button>
                        </View>
                    </View>

                    {/* Fila única con 3 inputs compactos */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "flex-end",
                        gap: 12,
                        position: 'relative',
                    }}>
                        {/* Búsqueda con selector de tipo integrado - MÁS ANCHO */}
                        <View style={{ flex: 2 }}>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: c.text.secondary,
                                marginBottom: 6,
                            }}>
                                {t("Nombre")}
                            </Text>
                            <SearchTypeInput
                                value={searchValue}
                                onChange={setSearchValue}
                            />
                        </View>

                        {/* Curso - MÁS ANCHO */}
                        <View style={{ flex: 1.5, zIndex: 90 }}>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: c.text.secondary,
                                marginBottom: 6,
                            }}>
                                {t("Curso")}
                            </Text>
                            <AnimatedDropdown
                                items={availableFichas}
                                value={selectedFicha}
                                onSelect={setSelectedFicha}
                                placeholder={t("Todos los cursos")}
                                searchable={true}
                                searchPlaceholder={t("Buscar curso...")}
                                maxVisible={5}
                                triggerIcon="book-open"
                                triggerHeight={42}
                            />
                        </View>

                        {/* Calendario de rango - MÁS ALTO z-index */}
                        <View style={{ flex: 2, zIndex: 100 }}>
                            <DateRangeCalendar
                                label={t("Fecha")}
                                startDate={dateRange.start}
                                endDate={dateRange.end}
                                onDateChange={handleDateRangeChange}
                                placeholder={t("Seleccionar rango")}
                                style={{ marginBottom: 0 }}
                            />
                        </View>
                    </View>
                </View>
            )}

            {/* Lista de usuarios */}
            <View style={{
                backgroundColor: c.background.surface,
                borderRadius: 12,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: c.border.primary,
            }}>
                {filteredUsers.length === 0 ? (
                    <View style={{ padding: 24 }}>
                        <EmptyState
                            icon="users"
                            title={t("No hay usuarios")}
                            description={
                                searchValue.searchText || selectedFicha || (dateRange.start && dateRange.end)
                                    ? t("No se encontraron usuarios con los filtros aplicados")
                                    : t("No hay usuarios registrados en el sistema")
                            }
                        />
                    </View>
                ) : (
                    <>
                        <View style={{
                            minHeight: 52,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottomWidth: 1,
                            borderBottomColor: c.border.primary,
                            backgroundColor: c.background.surfaceVariant,
                            gap: 12,
                        }}>
                            {/* Lado izquierdo: Contador o Checkbox de seleccionar todos */}
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                            }}>
                                {isExportMode && (
                                    <Checkbox
                                        checked={selectedUsers.size === filteredUsers.length}
                                        indeterminate={selectedUsers.size > 0 && selectedUsers.size < filteredUsers.length}
                                        onToggle={handleSelectAll}
                                        size="sm"
                                        variant="primary"
                                    />
                                )}
                                
                                <Text style={{
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: c.text.primary,
                                }}>
                                    {isExportMode && selectedUsers.size > 0
                                        ? `${selectedUsers.size} ${selectedUsers.size === 1 ? t("seleccionado") : t("seleccionados")}`
                                        : `${filteredUsers.length} ${filteredUsers.length === 1 ? t("registro") : t("registros")}`
                                    }
                                </Text>
                            </View>
                            
                            {/* Lado derecho: Botón Exportar o Filtros activos */}
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                            }}>
                                {!isExportMode && (searchValue.searchText || selectedFicha || (dateRange.start && dateRange.end)) && (
                                    <>
                                        <View style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 5,
                                            paddingHorizontal: 8,
                                            paddingVertical: 3,
                                            borderRadius: 6,
                                            backgroundColor: c.primary + "20",
                                        }}>
                                            <Feather name="filter" size={12} color={c.primary} />
                                            <Text style={{
                                                fontSize: 12,
                                                color: c.primary,
                                                fontWeight: "500",
                                            }}>
                                                {t("Filtros activos")}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={clearFilters}>
                                            <Text style={{
                                                fontSize: 12,
                                                color: c.status.danger,
                                                fontWeight: "500",
                                            }}>
                                                {t("Limpiar")}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                                
                                {/* Botón Exportar / Cancelar */}
                                <TouchableOpacity
                                    onPress={handleToggleExportMode}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        paddingHorizontal: 16,
                                        paddingVertical: 10,
                                        backgroundColor: isExportMode ? c.status.danger + "15" : c.background.surface,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: isExportMode ? c.status.danger : c.border.primary,
                                    }}
                                >
                                    <Feather 
                                        name={isExportMode ? "x" : "download"} 
                                        size={16} 
                                        color={isExportMode ? c.status.danger : c.text.primary} 
                                    />
                                    <Text style={{
                                        fontSize: 14,
                                        fontWeight: "500",
                                        color: isExportMode ? c.status.danger : c.text.primary,
                                    }}>
                                        {isExportMode ? t("Cancelar") : t("Exportar")}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView style={{ maxHeight: 363 }} showsVerticalScrollIndicator={false}>
                            {filteredUsers.map((user, index) => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    index={index}
                                    isLast={index === filteredUsers.length - 1}
                                    onPress={() => handleUserClick(user)}
                                    isExportMode={isExportMode}
                                    isSelected={selectedUsers.has(user.id)}
                                    onToggleSelect={handleToggleSelectUser}
                                />
                            ))}
                        </ScrollView>

                        {filteredUsers.length > 5 && (
                            <View style={{
                                padding: 12, // Reducido de 16 a 12
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: c.background.surfaceVariant,
                                borderTopWidth: 1,
                                borderTopColor: c.border.primary,
                            }}>
                                <Feather name="check-circle" size={20} color={c.status.success} style={{ marginBottom: 4 }} />
                                <Text style={{
                                    fontSize: 13,
                                    color: c.text.secondary,
                                    textAlign: "center",
                                }}>
                                    {t("Has llegado al final de la lista")}
                                </Text>
                            </View>
                        )}
                    </>
                )}
            </View>

            {/* Modal de historial de usuario */}
            {showHistoryModal && selectedUser && (
                <UserHistoryModal
                    user={selectedUser}
                    onClose={handleCloseHistoryModal}
                />
            )}
            
            {/* Modal de configuración de exportación */}
            <ExportConfigModal
                visible={showExportModal}
                onClose={handleCloseExportModal}
                onExport={handleExportSelected}
                selectedCount={selectedUsers.size}
            />
            
            {/* Botón flotante usando Portal - Se renderiza en el body, fuera de cualquier scroll */}
            {isExportMode && selectedUsers.size > 0 && typeof document !== 'undefined' && createPortal(
                <View style={{
                    position: "fixed",
                    bottom: 32,
                    right: 32,
                    zIndex: 9999,
                }}>
                    <Button
                        variant="primary"
                        onPress={handleOpenExportModal}
                        leftIcon={<Feather 
                                    name="download" 
                                    size={24} 
                                    color="#fff" 
                                    style={{
                                            transform: [
                                                { translateX: 4 },
                                                { translateY: -3 },
                                        ],
                                }}/>}
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8,
                        }}
                    />
                </View>,
                document.body
            )}
        </View>
    );
});

// Agregar displayName para ESLint
HistoricosSection.displayName = "HistoricosSection";
