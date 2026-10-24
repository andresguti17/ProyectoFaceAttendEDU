// ============================================================
//  FaceAttend EDU — StudentDetailModal
//  Modal de detalle de estudiante.
//  Los botones de gestión se muestran según permisos.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Badge, Avatar, Button, ProgressBar, useAttendanceColor } from "../common";
import { getAttendanceThresholds } from "../../../models/data/userDerivedData";
import { useTheme }       from "../hooks/useTheme";
import { useDateFormat } from "../hooks/useDateFormat";
import { useResponsive }  from "../hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAppData } from "../../../context/AppDataContext";
import { biometricCaptureApi } from "../../../services/api/biometricCaptureApi";
import BiometricEnrollmentModal from "./BiometricEnrollmentModal";


export default function StudentDetailModal({
    student,
    onClose,
    onEdit,
    canManage,
    canRegisterFace,
    canToggleStatus,
    canDeleteUser,
    onToggleStatus,
    onRemove,
    onBiometricsEnrolled,
}) {
    const { theme } = useTheme();
    const { formatDate } = useDateFormat();
    const { isSmall } = useResponsive();
    const { t }     = useTranslation();
    const c         = theme.colors;
    const { courses } = useAppData();

    const attColor = useAttendanceColor(student?.attendance ?? 0);
    const { minAttendance } = getAttendanceThresholds();

    // Obtener nombre completo del curso
    const courseName = useMemo(() => {
        if (!student?.course) return '—';
        const course = courses.find(c => c.code === student.course || c.name === student.course);
        return course ? course.name : student.course;
    }, [student?.course, courses]);

    // Lo que ms-biometric tiene de verdad: los flags locales de la fila no se cargan del backend.
    const [summary, setSummary] = useState(null);
    const [summaryTick, setSummaryTick] = useState(0);
    const [enrolling, setEnrolling] = useState(false);
    const personId = student?.personId;
    const showsBiometrics = !!canRegisterFace && !!personId && student?.userType !== "admin";

    useEffect(() => {
        setSummary(null);
        if (!showsBiometrics) return undefined;
        let cancelled = false;
        biometricCaptureApi.summary(personId).then(
            (data) => {
                if (!cancelled) setSummary(data);
            },
            () => {}
        );
        return () => {
            cancelled = true;
        };
    }, [showsBiometrics, personId, summaryTick]);

    if (!student) return null;

    // Asistencia y programa/semestre solo existen para estudiantes: un
    // admin no tiene academic_actor (MODELO §2.6) y la asistencia de
    // docentes todavía no se consulta (toStaffRow la deja en 0 fijo), así
    // que mostrarla aquí es un dato inventado, no una métrica real.
    const isStudent = (student.userType ?? "student") === "student";
    const isAdmin = student.userType === "admin";

    if (enrolling) {
        const missingFace = summary ? !summary.has_face : !student.hasFacial;
        const missingFingerprint = summary ? !summary.has_fingerprint : !student.hasFingerprint;
        return (
            <BiometricEnrollmentModal
                visible
                person={{ personId, name: student.name }}
                wantFace={missingFace || !missingFingerprint}
                wantFingerprint={missingFingerprint || !missingFace}
                onFinished={(flags) => onBiometricsEnrolled?.(personId, flags)}
                onClose={() => {
                    setEnrolling(false);
                    setSummaryTick((tick) => tick + 1);
                }}
            />
        );
    }

    return (
        <Modal transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity
                style={{
                    flex: 1,
                    backgroundColor: c.background.overlay,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 24,
                }}
                onPress={onClose}
                activeOpacity={1}
            >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                    <View style={{
                        backgroundColor: c.background.surface,
                        borderRadius: 14,
                        width: isSmall ? "94%" : 680,
                        minHeight: isSmall ? undefined : 480,
                        maxHeight: "92%",
                        overflow: "hidden",
                        shadowColor: "#000",
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 8,
                    }}>
                        {/* Header */}
                        <View style={{
                            padding: 20,
                            borderBottomWidth: 1,
                            borderBottomColor: c.border.primary,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                        }}>
                            <Avatar name={student.name} size={52} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: "700", color: c.text.primary }}>
                                    {student.name}
                                </Text>
                                <Text style={{ fontSize: 13, color: c.text.secondary, marginTop: 2 }}>
                                    {[student.code, student.username && student.username !== student.code ? `@${student.username}` : null]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </Text>
                                <View style={{ marginTop: 6 }}>
                                    <Badge variant={student.status === "active" ? "success" : "default"}>
                                        {student.status === "active" ? t("Activo") : t("Inactivo")}
                                    </Badge>
                                </View>
                            </View>
                            <TouchableOpacity onPress={onClose}>
                                <Feather name="x" size={18} color={c.text.secondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Body */}
                        <ScrollView style={{ padding: 20 }}>
                            <View style={{ gap: 10, marginBottom: 16 }}>
                                {[
                                    { label: t("Correo"), value: student.email, icon: "mail" },
                                    {
                                        label: t("Documento"),
                                        value: [student.documentType, student.documentNumber || student.document]
                                            .filter(Boolean)
                                            .join(" "),
                                        icon: "credit-card",
                                    },
                                    { label: t("Teléfono"), value: student.phone || student.telefono, icon: "phone" },
                                    { label: t("Nacimiento"), value: student.birthDate ? formatDate(student.birthDate) : "", icon: "calendar" },
                                    { label: t("Sangre"), value: student.bloodType, icon: "droplet" },
                                    { label: t("Dirección"), value: student.address, icon: "map-pin" },
                                    { label: t("Usuario"), value: student.username, icon: "at-sign" },
                                    ...(isStudent
                                        ? [
                                            { label: t("Programa"), value: courseName, icon: "book-open" },
                                            {
                                                label: t("Ficha"),
                                                value: student.ficha || student.cohortId,
                                                icon: "users",
                                            },
                                            { label: t("Semestre"), value: student.grade, icon: "trending-up" },
                                        ]
                                        : [{ label: t("Rol"), value: student.grade, icon: "briefcase" }]),
                                ]
                                    .filter(({ value }) => value != null && String(value).trim() !== "")
                                    .map(({ label, value, icon }) => (
                                        <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                            <Feather name={icon} size={16} color={c.text.secondary} />
                                            <Text style={{ fontSize: 13, color: c.text.secondary, width: 80 }}>{label}</Text>
                                            <Text style={{ fontSize: 14, fontWeight: "500", color: c.text.primary, flex: 1 }}>
                                                {value}
                                            </Text>
                                        </View>
                                    ))}
                            </View>

                            {/* Bloque de asistencia — solo estudiantes tienen esta métrica */}
                            {isStudent && (
                                <View style={{
                                    backgroundColor: c.background.app,
                                    borderRadius: 14,
                                    padding: 14,
                                    marginBottom: 16,
                                }}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                                        <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.primary }}>
                                            {t("Asistencia")}
                                        </Text>
                                        <Text style={{ fontSize: 16, fontWeight: "800", color: attColor }}>
                                            {student.attendance}%
                                        </Text>
                                    </View>
                                    <ProgressBar value={student.attendance} color={attColor} height={8} />
                                    <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: 8 }}>
                                        {(student.attendance ?? 0) >= minAttendance
                                            ? `${t("Cumple el mínimo requerido")} (${minAttendance}%)`
                                            : `⚠ ${t("Por debajo del mínimo requerido")} (${minAttendance}%)`}
                                    </Text>
                                </View>
                            )}

                            {/* Bloque biométrico — solo para quienes pueden registrar;
                                un admin no tiene academic_actor ni biometría (MODELO §2.6) */}
                            {canRegisterFace && !isAdmin && (() => {
                                // Determinar estado biométrico basado en facial y huella
                                const hasFacial = summary ? !!summary.has_face : student.hasFacial || false;
                                const hasFingerprint = summary ? !!summary.has_fingerprint : student.hasFingerprint || false;
                                
                                let biometricStatus = "pending";
                                if (hasFacial && hasFingerprint) {
                                    biometricStatus = "registered";
                                } else if (hasFacial || hasFingerprint) {
                                    biometricStatus = "partial";
                                }
                                
                                // Configuración por estado
                                const statusConfig = {
                                    registered: { 
                                        icon: "check-circle", 
                                        color: c.status.success, 
                                        text: t("Biometría registrada"),
                                        showButton: false
                                    },
                                    partial: { 
                                        icon: "alert-circle", 
                                        color: c.status.warning, 
                                        text: hasFacial 
                                            ? t("Falta registro de huella dactilar")
                                            : t("Falta registro facial"),
                                        showButton: true
                                    },
                                    pending: { 
                                        icon: "x-circle", 
                                        color: c.text.secondary, 
                                        text: t("Sin registro biométrico"),
                                        showButton: true
                                    },
                                };
                                const config = statusConfig[biometricStatus] || statusConfig.pending;
                                
                                return (
                                    <View style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: 14,
                                        borderWidth: 1,
                                        borderColor: c.border.primary,
                                        borderRadius: 14,
                                        marginBottom: 16,
                                    }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                            <Feather name="aperture" size={18} color={c.brand.primary} />
                                            <View>
                                                <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.primary }}>
                                                    {t("Reconocimiento biométrico")}
                                                </Text>
                                                <Text style={{ fontSize: 13, color: c.text.secondary }}>
                                                    {config.text}
                                                </Text>
                                            </View>
                                        </View>
                                        {config.showButton
                                            ? (
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    disabled={!personId}
                                                    onPress={() => setEnrolling(true)}
                                                >
                                                    {t("Registrar")}
                                                </Button>
                                            )
                                            : <Feather name={config.icon} size={18} color={config.color} />
                                        }
                                    </View>
                                );
                            })()}
                        </ScrollView>

                        {/* Footer */}
                        <View style={{
                            padding: 16,
                            borderTopWidth: 1,
                            borderTopColor: c.border.primary,
                            flexDirection: "row",
                            gap: 10,
                            justifyContent: "flex-end",
                            flexWrap: "wrap",
                        }}>
                            <Button variant="ghost" onPress={onClose}>{t("Cerrar")}</Button>
                            {/* Activar/Desactivar (HU-IAM-007) */}
                            {(canToggleStatus ?? canManage) && (
                                <Button
                                    variant="outline"
                                    onPress={() => onToggleStatus?.(student)}
                                >
                                    {(student?.status ?? "active") === "active"
                                        ? t("Desactivar")
                                        : t("Activar")}
                                </Button>
                            )}
                            {/* Eliminar lógico (HU-IAM-008, solo Super Admin) */}
                            {canDeleteUser && (
                                <Button
                                    variant="danger"
                                    onPress={() => onRemove?.(student)}
                                >
                                    {t("Eliminar")}
                                </Button>
                            )}
                            {/* Editar solo para quienes pueden gestionar */}
                            {canManage && (
                                <Button
                                    variant="primary"
                                    onPress={onEdit}
                                >
                                    {student?.userType === "teacher"
                                        ? t("Editar docente")
                                        : student?.userType === "admin"
                                            ? t("Editar administrador")
                                            : t("Editar estudiante")}
                                </Button>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

