// ============================================================
//  FaceAttend EDU — History VIEW (Presentation Layer)
//
//  RESPONSABILIDAD: Presentación del historial de asistencia
//
//  ✓ Filtros documentados en HU-HIST-001: periodo, estado, ficha,
//    persona, ambiente e instructor (se combinan, AC9)
//  ✓ Resultado paginado con los campos mínimos del AC14
//  ✓ El alcance visible depende del rol (AC10/AC11/AC12)
//
//  Toda la lógica de negocio está en useHistoryViewModel.
// ============================================================

import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Alert, Badge, Button, EmptyState, PageHeader, Select } from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useHistoryViewModel, PAGE_SIZE } from "../viewmodels/useHistoryViewModel";
import { useRolePermissions } from "../viewmodels/useRolePermissions";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";

const STATUS_META = {
    Present: { variant: "success", icon: "check-circle", label: "Presente" },
    Absent: { variant: "danger", icon: "x-circle", label: "Ausente" },
    Late: { variant: "warning", icon: "clock", label: "Tardanza" },
    Justified: { variant: "info", icon: "file-text", label: "Justificada" },
};

function statusBadge(status) {
    const meta = STATUS_META[status] || { variant: "default", icon: "help-circle", label: status || "—" };
    return meta;
}

function Stat({ label, value, color, icon }) {
    const { theme } = useTheme();
    const c = theme.colors;
    return (
        <View
            style={{
                flexBasis: 140,
                flexGrow: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: c.background.surface,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: c.border.primary + "40",
            }}
        >
            <View
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: color + "20",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Feather name={icon} size={14} color={color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: c.text.secondary,
                        textTransform: "uppercase",
                        letterSpacing: 0.2,
                    }}
                >
                    {label}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: "800", color: c.text.primary, marginTop: -2 }}>
                    {value}
                </Text>
            </View>
        </View>
    );
}

export default function HistoryView() {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();
    const vm = useHistoryViewModel();
    const navigation = useNavigation();
    const permissions = useRolePermissions();
    // Solo quien puede enviar justificaciones (alumno) ve el atajo;
    // la pantalla de Justificaciones ya separa elegibles de enviadas
    // y bloquea duplicados (HU-JUS-001 AC5).
    const canJustify = permissions.canSubmitJustifications ?? false;
    const justifyRow = (row) => (row.status === "Absent" || row.status === "Late") && canJustify;

    if (vm.isPreparing) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={c.brand.primary} />
            </View>
        );
    }

    const subtitle = vm.isLoading
        ? t("Consultando registros...")
        : `${vm.scope.label} · ${vm.rows.length} ${vm.rows.length === 1 ? t("registro") : t("registros")}`;

    const renderRow = (row) => {
        const meta = statusBadge(row.status);
        if (isSmall) {
            return (
                <View
                    key={row.key}
                    style={{
                        backgroundColor: c.background.surface,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: c.border.primary + "40",
                        padding: 12,
                        gap: 6,
                    }}
                >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontWeight: "700", color: c.text.primary, fontSize: 14 }}>
                            {row.personName}
                        </Text>
                        <Badge variant={meta.variant} size="sm" icon={meta.icon}>
                            {t(meta.label)}
                        </Badge>
                    </View>
                    <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                        {[row.date, row.time].filter(Boolean).join(" · ")}
                    </Text>
                    <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                        {[row.cohort, row.course, row.environment, row.instructor].filter(Boolean).join(" · ")}
                    </Text>
                    {justifyRow(row) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onPress={() => navigation.navigate("Justifications")}
                        >
                            {t("Justificar")}
                        </Button>
                    )}
                </View>
            );
        }

        const cell = { flex: 1, fontSize: 13, color: c.text.primary };
        return (
            <View
                key={row.key}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: c.border.primary + "30",
                    gap: 8,
                }}
            >
                <Text style={{ ...cell, flex: 1.4, fontWeight: "600" }}>{row.personName}</Text>
                <Text style={{ ...cell, flex: 0.8 }}>{row.date || "—"}</Text>
                <Text style={{ ...cell, flex: 0.6 }}>{row.time || "—"}</Text>
                <View style={{ flex: 1 }}>
                    <Badge variant={meta.variant} size="sm" icon={meta.icon}>
                        {t(meta.label)}
                    </Badge>
                </View>
                <Text style={{ ...cell, flex: 0.7 }}>{row.cohort || "—"}</Text>
                <Text style={{ ...cell, flex: 1.1 }}>{row.course || "—"}</Text>
                <Text style={{ ...cell, flex: 1 }}>{row.environment || "—"}</Text>
                <Text style={{ ...cell, flex: 1.2 }}>{row.instructor || "—"}</Text>
                {justifyRow(row) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onPress={() => navigation.navigate("Justifications")}
                    >
                        {t("Justificar")}
                    </Button>
                )}
            </View>
        );
    };

    const headerRow = (
        <View
            style={{
                flexDirection: "row",
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: c.background.hover,
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                gap: 8,
            }}
        >
            {[
                { label: t("Persona"), flex: 1.4 },
                { label: t("Fecha"), flex: 0.8 },
                { label: t("Hora"), flex: 0.6 },
                { label: t("Estado"), flex: 1 },
                { label: t("Ficha"), flex: 0.7 },
                { label: t("Curso"), flex: 1.1 },
                { label: t("Ambiente"), flex: 1 },
                { label: t("Instructor"), flex: 1.2 },
            ].map((col) => (
                <Text
                    key={col.label}
                    style={{
                        flex: col.flex,
                        fontSize: 11,
                        fontWeight: "700",
                        color: c.text.secondary,
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                    }}
                >
                    {col.label}
                </Text>
            ))}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={t("Historial de asistencia")}
                subtitle={subtitle}
                actions={
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onPress={vm.resetFilters}
                            leftIcon={<Feather name="rotate-ccw" size={16} color={c.text.secondary} />}
                        >
                            {t("Limpiar")}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            loading={vm.isLoading}
                            onPress={vm.runQuery}
                            leftIcon={<Feather name="search" size={16} color={c.brand.textOnPrimary} />}
                        >
                            {t("Consultar")}
                        </Button>
                    </>
                }
            />

            <ScrollView
                contentContainerStyle={{ padding: isSmall ? 16 : 24, gap: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Filtros de la HU-HIST-001 */}
                <View
                    style={{
                        backgroundColor: c.background.surface,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: c.border.primary + "40",
                        padding: 16,
                        gap: 12,
                    }}
                >
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                        <View style={{ flexBasis: 180, flexGrow: 1 }}>
                            <Select
                                label={t("Periodo")}
                                value={vm.filters.period}
                                onValueChange={(v) => vm.setFilter("period", v)}
                                options={[
                                    { value: "all", label: t("Todo") },
                                    { value: "today", label: t("Hoy") },
                                    { value: "7", label: t("Últimos 7 días") },
                                    { value: "30", label: t("Últimos 30 días") },
                                    { value: "month", label: t("Este mes") },
                                ]}
                            />
                        </View>
                        <View style={{ flexBasis: 180, flexGrow: 1 }}>
                            <Select
                                label={t("Estado")}
                                value={vm.filters.status}
                                onValueChange={(v) => vm.setFilter("status", v)}
                                options={[
                                    { value: "", label: t("Todos") },
                                    ...vm.statusOptions.map((s) => ({ value: s, label: t(STATUS_META[s].label) })),
                                ]}
                            />
                        </View>
                        {vm.cohortOptions.length > 0 && (
                            <View style={{ flexBasis: 180, flexGrow: 1 }}>
                                <Select
                                    label={t("Ficha")}
                                    value={vm.filters.cohortId}
                                    onValueChange={(v) => vm.setFilter("cohortId", v)}
                                    options={[
                                        { value: "", label: t("Todas") },
                                        ...vm.cohortOptions,
                                    ]}
                                />
                            </View>
                        )}
                        {vm.personOptions.length > 1 && (
                            <View style={{ flexBasis: 220, flexGrow: 1 }}>
                                <Select
                                    label={t("Persona")}
                                    value={vm.filters.personId}
                                    onValueChange={(v) => vm.setFilter("personId", v)}
                                    searchable
                                    options={[
                                        { value: "", label: t("Todas") },
                                        ...vm.personOptions,
                                    ]}
                                />
                            </View>
                        )}
                        <View style={{ flexBasis: 180, flexGrow: 1 }}>
                            <Select
                                label={t("Ambiente")}
                                value={vm.filters.environmentId}
                                onValueChange={(v) => vm.setFilter("environmentId", v)}
                                options={[
                                    { value: "", label: t("Todos") },
                                    ...vm.environmentOptions,
                                ]}
                            />
                        </View>
                        <View style={{ flexBasis: 200, flexGrow: 1 }}>
                            <Select
                                label={t("Instructor")}
                                value={vm.filters.instructorId}
                                onValueChange={(v) => vm.setFilter("instructorId", v)}
                                options={[
                                    { value: "", label: t("Todos") },
                                    ...vm.instructorOptions,
                                ]}
                            />
                        </View>
                    </View>
                </View>

                {vm.error && <Alert type="error" title={t("No se pudo consultar")} message={vm.error} closable />}
                {vm.notice && <Alert type="info" message={vm.notice} closable />}

                {/* Estadísticas del resultado */}
                {vm.hasQueried && !vm.error && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                        <Stat label={t("Total")} value={vm.stats.total} color={c.brand.primary} icon="layers" />
                        <Stat
                            label={t("Presentes")}
                            value={vm.stats.present}
                            color={c.status.success}
                            icon="check-circle"
                        />
                        <Stat
                            label={t("Ausentes")}
                            value={vm.stats.absent}
                            color={c.status.error}
                            icon="x-circle"
                        />
                        <Stat label={t("Tardanzas")} value={vm.stats.late} color={c.status.warning} icon="clock" />
                        <Stat
                            label={t("Justificadas")}
                            value={vm.stats.justified}
                            color={c.status.info || c.brand.primary}
                            icon="file-text"
                        />
                    </View>
                )}

                {/* Resultados */}
                {!vm.hasQueried ? (
                    <EmptyState
                        icon="clock"
                        title={t("Consulta tu historial")}
                        message={t("Usa los filtros y pulsa Consultar para ver los registros de asistencia")}
                    />
                ) : vm.rows.length === 0 && !vm.error ? (
                    <EmptyState
                        icon="search"
                        title={t("Sin registros de asistencia")}
                        message={t("No se encontraron registros para los filtros especificados")}
                    />
                ) : (
                    vm.rows.length > 0 && (
                        <View
                            style={{
                                backgroundColor: c.background.surface,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: c.border.primary + "40",
                                overflow: "hidden",
                            }}
                        >
                            {!isSmall && headerRow}
                            {vm.pageRows.map(renderRow)}

                            {/* Paginación (AC15) */}
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: 12,
                                    gap: 8,
                                }}
                            >
                                <Text style={{ color: c.text.secondary, fontSize: 12 }}>
                                    {`${t("Mostrando")} ${vm.page * PAGE_SIZE + 1}–${Math.min(
                                        (vm.page + 1) * PAGE_SIZE,
                                        vm.rows.length
                                    )} ${t("de")} ${vm.rows.length}`}
                                </Text>
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={vm.page === 0}
                                        onPress={() => vm.setPage(Math.max(0, vm.page - 1))}
                                    >
                                        {t("Anterior")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={vm.page >= vm.pageCount - 1}
                                        onPress={() => vm.setPage(vm.page + 1)}
                                    >
                                        {t("Siguiente")}
                                    </Button>
                                </View>
                            </View>
                        </View>
                    )
                )}
            </ScrollView>
        </View>
    );
}
