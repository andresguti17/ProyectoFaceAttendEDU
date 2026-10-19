// ============================================================
//  FaceAttend EDU — StudentCourses
//
//  Vista de ficha para estudiantes: solo la ficha en la que
//  el estudiante está matriculado (su propio courseId), sin
//  acciones de gestión. Normalmente es una sola tarjeta, pero
//  se renderiza como lista por robustez (podría no haber
//  matrícula activa, o excepcionalmente más de una).
// ============================================================

import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card, EmptyState } from "../../components/common";
import { useTheme } from "../../components/hooks/useTheme";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useCoursesViewModel } from "../../../viewmodels/useCoursesViewModel";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { CourseCard } from "./AdminCourses";
import { CourseDetailModal } from "./modals";

export function StudentCourses({ vm: vmProp }) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const vmLocal = useCoursesViewModel();
    const vm = vmProp || vmLocal;
    const { t } = useTranslation();

    if (vm.isLoading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={c.brand.primary} />
            </View>
        );
    }

    // Solo lo propio de Cursos: la sección "Compañeros" se retiró del menú
    // del estudiante, así que la tarjeta ya no enlaza a Usuarios. Acá se
    // resume sin recalcular cuentas con datos parciales (un curso puede
    // compartirse con otra ficha distinta).
    const statCards = [
        { label: t("Mis cursos"), value: vm.myStats.total, color: c.brand.primary, icon: "book-open" },
        { label: t("Asistencia promedio"), value: `${vm.myStats.avgAttendance}%`, color: c.status.success, icon: "percent" },
    ];

    return (
        <ScrollView
            contentContainerStyle={{ padding: isSmall ? 16 : 24, gap: 16 }}
            showsVerticalScrollIndicator={false}
        >
            {/* Mini stats de mis cursos */}
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                {statCards.map(({ label, value, color, icon }) => (
                    <View
                        key={label}
                        style={{
                            flexBasis: isSmall ? "47%" : "23%",
                            flexGrow: 1,
                            backgroundColor: c.background.surface,
                            borderRadius: 12,
                            padding: 14,
                            gap: 6,
                            borderWidth: 1,
                            borderColor: c.border.primary + "40",
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Feather name={icon} size={14} color={color} />
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: "600",
                                    color: c.text.secondary,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.3,
                                }}
                            >
                                {label}
                            </Text>
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: "800", color: c.text.primary }}>{value}</Text>
                    </View>
                ))}
            </View>

            {/* Mis cursos */}
            {vm.myFiltered.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<Feather name="book-open" size={40} color={c.text.secondary} />}
                        title={t("Sin cursos asignados")}
                        description={t("Aún no estás matriculado en ningún curso")}
                    />
                </Card>
            ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    {vm.myFiltered.map((course) => (
                        <View key={course.id} style={{ flexBasis: isSmall ? "100%" : "30%", flexGrow: 1 }}>
                            <CourseCard
                                course={course}
                                onPress={() => vm.selectCourse(course)}
                            />
                        </View>
                    ))}
                </View>
            )}

            {/* Modal de detalle (solo lectura: canManage=false) */}
            <CourseDetailModal course={vm.selected} onClose={vm.clearSelection} canManage={false} />
        </ScrollView>
    );
}

export default StudentCourses;
