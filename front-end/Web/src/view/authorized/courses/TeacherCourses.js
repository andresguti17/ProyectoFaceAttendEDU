// ============================================================
//  FaceAttend EDU — TeacherCourses
//
//  Vista de fichas para instructores: solo las fichas donde el
//  profesor es el instructor asignado (instructorActorIds),
//  sin acciones de gestión (crear/importar son solo de admin).
// ============================================================

import React from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Card, Badge, Button, EmptyState, ProgressBar, useAttendanceColor } from "../../components/common";
import { useTheme } from "../../components/hooks/useTheme";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useCoursesViewModel } from "../../../viewmodels/useCoursesViewModel";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../../../context/AuthContext";
import { listBlocks, listCohorts, listEnvironments, optional } from "../../../services/api/referenceData";
import { CourseDetailModal } from "./modals";

const DAY_LABELS = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom" };

function blockDay(block) {
    return block.dayOfWeek ?? block.day_of_week ?? null;
}

// Bloques del docente para un curso, con ficha, aula y horario resueltos.
function useTeacherCourseMeta() {
    const { user } = useAuth();
    const [meta, setMeta] = React.useState({ blocks: [], cohorts: new Map(), envs: new Map() });

    React.useEffect(() => {
        let cancelled = false;
        Promise.all([
            optional(listBlocks(), []),
            optional(listCohorts(), []),
            optional(listEnvironments(), []),
        ]).then(([blocks, cohorts, envs]) => {
            if (cancelled) return;
            const blockList = Array.isArray(blocks) ? blocks : [];
            const cohortList = Array.isArray(cohorts) ? cohorts : cohorts?.content ?? [];
            const envList = Array.isArray(envs) ? envs : envs?.content ?? [];
            setMeta({
                blocks: blockList.filter(
                    (b) => Number(b.instructorActorId ?? b.instructor_actor_id) === Number(user?.academicActorId)
                ),
                cohorts: new Map(
                    cohortList.map((ch) => [Number(ch.cohortId ?? ch.cohort_id ?? ch.id), ch.code ?? ""])
                ),
                envs: new Map(
                    envList.map((e) => [
                        Number(e.environmentId ?? e.environment_id ?? e.id),
                        e.code ?? e.name ?? "",
                    ])
                ),
            });
        });
        return () => {
            cancelled = true;
        };
    }, [user?.academicActorId]);

    return meta;
}

// Tarjeta de clase del docente: curso + ficha + horario + aula,
// con accesos a estudiantes y detalle. Solo lectura.
function TeacherCourseCard({ course, meta, onPress, onStudentsPress }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const barColor = useAttendanceColor(course.avgAttendance || 0);

    const myBlocks = meta.blocks.filter(
        (b) => Number(b.courseId ?? b.course_id) === Number(course.id)
    );
    const fichas = [...new Set(myBlocks.map((b) => meta.cohorts.get(Number(b.cohortId ?? b.cohort_id))).filter(Boolean))];
    const rooms = [...new Set(myBlocks.map((b) => meta.envs.get(Number(b.environmentId ?? b.environment_id))).filter(Boolean))];
    const slots = myBlocks.map((b) => {
        const day = DAY_LABELS[Number(blockDay(b))] ?? "";
        const from = String(b.startsAt ?? b.starts_at ?? "").slice(0, 5);
        const to = String(b.endsAt ?? b.ends_at ?? "").slice(0, 5);
        return `${day} ${from}–${to}`.trim();
    }).filter((s) => s);

    return (
        <TouchableOpacity onPress={onPress} style={{ flex: 1 }}>
            <Card padding={0} style={{ overflow: "hidden", height: "100%" }}>
                <View style={{ height: 5, backgroundColor: course.color }} />
                <View style={{ padding: 16, flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: course.color, letterSpacing: 0.5 }}>
                            {course.code}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {fichas.slice(0, 2).map((f) => (
                                <Badge key={f} variant="default" size="sm">{f}</Badge>
                            ))}
                            {course.creditHours != null && (
                                <Badge variant="info" size="sm">{`${course.creditHours} ${t("créd.")}`}</Badge>
                            )}
                        </View>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: c.text.primary, lineHeight: 20 }} numberOfLines={2}>
                        {course.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: c.text.secondary }} numberOfLines={1}>
                        {course.professor || t("Sin instructor asignado")}
                    </Text>
                    {(slots.length > 0 || rooms.length > 0) && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Feather name="clock" size={14} color={c.text.secondary} />
                            <Text style={{ fontSize: 13, color: c.text.secondary }} numberOfLines={1}>
                                {[slots.slice(0, 2).join(" · "), rooms[0]].filter(Boolean).join(" · ")}
                            </Text>
                        </View>
                    )}
                    <View style={{ marginTop: "auto" }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                            <Text style={{ fontSize: 12, color: c.text.secondary }}>
                                {`${course.students ?? 0} ${t("estudiantes")}`}
                            </Text>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: barColor }}>
                                {course.avgAttendance || 0}%
                            </Text>
                        </View>
                        <ProgressBar value={course.avgAttendance || 0} color={barColor} height={5} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={onStudentsPress}>
                            {t("Ver estudiantes")}
                        </Button>
                        <Button variant="ghost" size="sm" style={{ flex: 1 }} onPress={onPress}>
                            {t("Detalle")}
                        </Button>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );
}

export function TeacherCourses({ vm: vmProp }) {
    const { isSmall, isMedium } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const vmLocal = useCoursesViewModel();
    const vm = vmProp || vmLocal;
    const { t } = useTranslation();
    const navigation = useNavigation();

    const handleNavigateToStudents = React.useCallback(
        (course) => {
            navigation.navigate("Users", {
                section: "students",
                searchQuery: course.code,
                sortBy: "name",
                sortOrder: "asc",
                filterColumn: "name",
            });
        },
        [navigation]
    );
    const meta = useTeacherCourseMeta();

    if (vm.isLoading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={c.brand.primary} />
            </View>
        );
    }

    const statCards = [
        { label: t("Mis cursos"), value: vm.myStats.total, color: c.brand.primary, icon: "book-open" },
        { label: t("Mis estudiantes"), value: vm.myStats.totalStudents, color: c.status.success, icon: "users" },
        { label: t("Asistencia prom."), value: `${vm.myStats.avgAttendance}%`, color: c.brand.primary, icon: "percent" },
        { label: t("Con alerta"), value: vm.myStats.alertCount, color: c.status.warning, icon: "alert-triangle" },
    ];

    return (
        <ScrollView
            contentContainerStyle={{ padding: isSmall ? 16 : 24, gap: 16 }}
            showsVerticalScrollIndicator={false}
        >
            {/* Mini stats de mis fichas */}
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

            {/* Grid de mis fichas */}
            {vm.myFiltered.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<Feather name="book-open" size={40} color={c.text.secondary} />}
                        title={t("Sin cursos asignados")}
                        description={t("Aún no tienes cursos asignados como instructor")}
                    />
                </Card>
            ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    {vm.myFiltered.map((course) => (
                        <View
                            key={course.id}
                            style={{
                                flexBasis: isSmall ? "100%" : isMedium ? "48%" : "31%",
                                flexGrow: 0,
                                flexShrink: 1,
                            }}
                        >
                            <TeacherCourseCard
                                course={course}
                                meta={meta}
                                onPress={() => vm.selectCourse(course)}
                                onStudentsPress={() => handleNavigateToStudents(course)}
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

export default TeacherCourses;
