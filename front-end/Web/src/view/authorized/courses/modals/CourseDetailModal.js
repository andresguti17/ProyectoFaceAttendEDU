// ============================================================
//  FaceAttend EDU — CourseDetailModal
//  Modal de detalle de curso/ficha.
//  Los botones de gestión se muestran según permisos.
// ============================================================

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BaseModal, Button } from "../../../components/common";
import { useTheme } from "../../../components/hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { useCourseDetails } from "../../../../core/hooks/useCourseDetails";

export default function CourseDetailModal({ course, onClose, canManage, canDeleteCourse, onEdit, onRemove, onToggleStatus }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    
    // Usar el hook centralizado para obtener toda la información calculada
    const {
        currentInstructor,
        currentRoom,
        enrolledStudentsCount,
        courseAvgAttendance,
        courseShift,
        coursePeriodDisplay,
    } = useCourseDetails(course);

    if (!course) return null;

    return (
        <BaseModal
            visible={!!course}
            onClose={onClose}
            title={course.name}
            subtitle={course.code}
            icon="book-open"
            iconColor={course.color}
            accentColor={course.color}
            maxWidth={520}
            footer={
                <React.Fragment>
                    <Button variant="ghost" onPress={onClose}>
                        {t("Cerrar")}
                    </Button>
                    {canDeleteCourse && (
                        <Button
                            variant="danger"
                            onPress={() => onRemove?.(course)}
                        >
                            {t("Eliminar")}
                        </Button>
                    )}
                    {canManage && (
                        <>
                            <Button
                                variant="outline"
                                onPress={() => onToggleStatus?.(course)}
                            >
                                {(course?.status ?? "active") === "active"
                                    ? t("Desactivar")
                                    : t("Activar")}
                            </Button>
                            <Button
                                variant="primary"
                                onPress={() => onEdit?.(course)}
                                leftIcon={<Feather name="edit-3" size={14} color={c.brand.textOnPrimary} />}
                            >
                                {t("Editar curso")}
                            </Button>
                        </>
                    )}
                </React.Fragment>
            }
        >
            {/* Grid de información */}
            <View
                style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 12,
                }}
            >
                {[
                    { label: t("Docente"), value: currentInstructor, icon: "user" },
                    { label: t("Semestre"), value: coursePeriodDisplay, icon: "calendar" },
                    { label: t("Jornada"), value: courseShift, icon: "clock" },
                    { label: t("Aula"), value: currentRoom, icon: "map-pin" },
                    {
                        label: t("Estudiantes"),
                        value: `${enrolledStudentsCount} ${t("en curso")}`,
                        icon: "users",
                    },
                ].map(({ label, value, icon }) => (
                    <View
                        key={label}
                        style={{
                            width: "47%",
                            backgroundColor: c.background.app,
                            borderRadius: 14,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: c.border.primary + "40",
                        }}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 6,
                            }}
                        >
                            <Feather name={icon} size={12} color={c.text.secondary} />
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: "600",
                                    color: c.text.secondary,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                }}
                            >
                                {label}
                            </Text>
                        </View>
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: c.text.primary,
                            }}
                        >
                            {value}
                        </Text>
                    </View>
                ))}

                {/* Asistencia - Tarjeta especial con progress bar */}
                <View
                    style={{
                        width: "47%",
                        backgroundColor: c.background.app,
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: c.border.primary + "40",
                    }}
                >
                    {/* Header: ASISTENCIA (izq) y 85% (der) */}
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                        }}
                    >
                        {/* Lado izquierdo: ícono + ASISTENCIA */}
                        <View style={{ gap: 6 }}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Feather name="check-circle" size={12} color={c.text.secondary} />
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: "600",
                                        color: c.text.secondary,
                                        textTransform: "uppercase",
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    {t("Asistencia")}
                                </Text>
                            </View>
                            {/* Subtítulo: promedio */}
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: c.text.tertiary,
                                    marginLeft: 18, // Alineado con el texto ASISTENCIA
                                    marginTop:-6,
                                }}
                            >
                                promedio
                            </Text>
                        </View>
                        
                        {/* Lado derecho: 85% */}
                        <Text
                            style={{
                                fontSize: 20,
                                fontWeight: "700",
                                color: courseAvgAttendance >= 80 
                                    ? c.status.success 
                                    : courseAvgAttendance >= 60 
                                    ? c.status.warning 
                                    : c.status.error,
                            }}
                        >
                            {courseAvgAttendance}%
                        </Text>
                    </View>
                    
                    {/* Progress bar de extremo a extremo */}
                    <View
                        style={{
                            height: 6,
                            backgroundColor: c.border.primary + "40",
                            borderRadius: 10,
                            overflow: "hidden",
                            marginTop: 4,
                        }}
                    >
                        <View
                            style={{
                                height: "100%",
                                width: `${courseAvgAttendance}%`,
                                backgroundColor: courseAvgAttendance >= 80 
                                    ? c.status.success 
                                    : courseAvgAttendance >= 60 
                                    ? c.status.warning 
                                    : c.status.error,
                                borderRadius: 10,
                            }}
                        />
                    </View>
                </View>
            </View>
        </BaseModal>
    );
}
