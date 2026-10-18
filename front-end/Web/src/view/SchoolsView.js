// ============================================================
//  FaceAttend EDU — Schools VIEW (Presentation Layer)
//
//  RESPONSABILIDAD: Gestión de escuelas del super admin ("cómo se presenta")
//
//  Este componente:
//  ✓ Lista las sedes con su asistencia media y su estado
//  ✓ Permite crear, editar y activar/desactivar sedes
//  ✓ Muestra KPIs globales (sedes, activas, asistencia)
//
//  Toda la lógica de negocio está en useSchoolsViewModel.
//  Las acciones de gestión se muestran según canManage (super admin).
// ============================================================

import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
    Alert,
    AnimatedDropdown,
    Badge,
    BaseModal,
    Button,
    Card,
    ConfirmModal,
    EmptyState,
    Loader,
    PageHeader,
    ProgressBar,
    SearchInput,
    StatCard,
    TextInput,
} from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import {
    ATTENDANCE_THRESHOLD,
    useSchoolsViewModel,
} from "../viewmodels/useSchoolsViewModel";
import { useCityOptions } from "../viewmodels/useCityOptions";

function attendanceColor(avg, c) {
    if (avg == null) return c.text.disabled;
    if (avg >= 85) return c.status.success;
    if (avg >= ATTENDANCE_THRESHOLD) return c.status.warning;
    return c.status.danger;
}

function attendanceVariant(avg) {
    if (avg == null) return "default";
    if (avg >= 85) return "success";
    if (avg >= ATTENDANCE_THRESHOLD) return "warning";
    return "danger";
}

function SchoolCard({ school, vm, t, c }) {
    return (
        <Card variant="outlined" style={{ flexBasis: 260, flexGrow: 1 }}>
            <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text
                        style={{ fontSize: 15, fontWeight: "700", color: c.text.primary, flex: 1 }}
                        numberOfLines={1}
                    >
                        {school.name}
                    </Text>
                    <Badge variant={school.status ? "success" : "default"} size="sm">
                        {school.status ? t("Activa") : t("Inactiva")}
                    </Badge>
                </View>

                <Text style={{ fontSize: 12, color: c.text.secondary }}>
                    {[
                        school.code ? `${t("Código")}: ${school.code}` : null,
                        school.cityName || null,
                        school.address || null,
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </Text>

                <ProgressBar
                    value={school.avgAttendance ?? 0}
                    label={t("Asistencia")}
                    showValue
                    color={attendanceColor(school.avgAttendance, c)}
                    size="sm"
                />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Badge variant="default" size="sm" icon="users">
                        {`${school.students} ${t("aprendices")}`}
                    </Badge>
                    <Badge variant={attendanceVariant(school.avgAttendance)} size="sm">
                        {school.avgAttendance == null ? t("Sin datos") : `${school.avgAttendance}%`}
                    </Badge>
                    {school.atRisk > 0 && (
                        <Badge variant="danger" size="sm">
                            {`${school.atRisk} ${t("en riesgo")}`}
                        </Badge>
                    )}
                </View>

                {vm.canManage && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                        <Button
                            variant="outline"
                            size="sm"
                            onPress={() => vm.openEdit(school)}
                            leftIcon={<Feather name="edit-2" size={14} color={c.text.primary} />}
                        >
                            {t("Editar")}
                        </Button>
                        <Button
                            variant={school.status ? "danger" : "primary"}
                            size="sm"
                            onPress={() => vm.requestStatusChange(school)}
                            leftIcon={
                                <Feather
                                    name={school.status ? "pause-circle" : "play-circle"}
                                    size={14}
                                    color={school.status ? "#fff" : "#fff"}
                                />
                            }
                        >
                            {school.status ? t("Desactivar") : t("Activar")}
                        </Button>
                    </View>
                )}
            </View>
        </Card>
    );
}

function SchoolFormModal({ vm, t, c }) {
    const isEdit = vm.modalMode === "edit";
    const cityItems = useCityOptions();
    return (
        <BaseModal
            visible={vm.modalMode !== "none"}
            onClose={vm.closeModal}
            title={isEdit ? t("Editar sede") : t("Nueva sede")}
            subtitle={t("Datos de la institución")}
            icon="map"
            iconColor={c.brand.primary}
            size="md"
            footer={
                <>
                    <Button variant="outline" onPress={vm.closeModal} disabled={vm.isSaving}>
                        {t("Cancelar")}
                    </Button>
                    <Button variant="primary" onPress={vm.save} loading={vm.isSaving}>
                        {isEdit ? t("Guardar") : t("Crear sede")}
                    </Button>
                </>
            }
        >
            {vm.formError && (
                <View style={{ marginBottom: 16 }}>
                    <Alert type="error" message={vm.formError} />
                </View>
            )}

            <View style={{ gap: 14 }}>
                <TextInput
                    label={t("Nombre")}
                    required
                    value={vm.form.name}
                    onChangeText={(v) => vm.setField("name", v)}
                    placeholder={t("Institución Educativa Ejemplo")}
                />
                <TextInput
                    label={t("Código")}
                    required={!isEdit}
                    value={vm.form.code}
                    onChangeText={(v) => vm.setField("code", v)}
                    placeholder={t("IE-001")}
                    hint={isEdit ? t("Opcional al editar") : null}
                />
                <TextInput
                    label={t("Dirección")}
                    value={vm.form.address}
                    onChangeText={(v) => vm.setField("address", v)}
                />
                <View>
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: c.text.secondary,
                            marginBottom: 6,
                        }}
                    >
                        {t("Ciudad")}
                    </Text>
                    <AnimatedDropdown
                        items={cityItems}
                        value={vm.form.cityName}
                        onSelect={(v) => vm.setField("cityName", v)}
                        placeholder={t("Seleccionar ciudad")}
                        triggerIcon="map-pin"
                        searchable
                        searchPlaceholder={t("Buscar ciudad...")}
                        triggerHeight={48}
                    />
                    <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: 6 }}>
                        {t("Opcional · catálogo de ciudades de Colombia")}
                    </Text>
                </View>
                <TextInput
                    label={t("Teléfono")}
                    type="phone"
                    value={vm.form.phone}
                    onChangeText={(v) => vm.setField("phone", v)}
                />
                <TextInput
                    label={t("Correo")}
                    type="email"
                    value={vm.form.email}
                    onChangeText={(v) => vm.setField("email", v)}
                />
            </View>
        </BaseModal>
    );
}

export default function SchoolsView() {
    const vm = useSchoolsViewModel();
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;

    if (vm.isLoading) {
        return <Loader fullScreen message={t("Cargando sedes...")} />;
    }

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={t("Escuelas")}
                subtitle={`${vm.stats.total} ${t("sedes registradas")}`}
                actions={
                    vm.canManage ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onPress={vm.openCreate}
                            leftIcon={<Feather name="plus" size={16} color="#fff" />}
                        >
                            {t("Nueva sede")}
                        </Button>
                    ) : null
                }
            />

            <ScrollView
                contentContainerStyle={{
                    padding: isSmall ? 16 : 24,
                    gap: 16,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Feedback de CRUD */}
                {vm.feedback && (
                    <Alert
                        type={vm.feedback.type}
                        message={vm.feedback.message}
                        closable
                        onClose={vm.clearFeedback}
                    />
                )}

                {/* Error de carga de sedes */}
                {vm.error && (
                    <Alert
                        type="error"
                        title={t("No se pudieron cargar las sedes")}
                        message={vm.error}
                        closable
                        onClose={vm.clearError}
                    />
                )}

                {/* Aprendices sin sede asignada: dato que el super admin
                    debe ver para poder corregirlo en su gestión. */}
                {vm.unassignedStudents > 0 && (
                    <Alert
                        type="warning"
                        message={`${vm.unassignedStudents} ${t(
                            "aprendices no tienen sede asignada"
                        )}`}
                    />
                )}

                {/* KPIs globales */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    <View style={{ flexBasis: isSmall ? "47%" : "23%", flexGrow: 1, minWidth: 150 }}>
                        <StatCard
                            label={t("Sedes")}
                            value={vm.stats.total}
                            icon={<Feather name="map" size={20} color={c.brand.primary} />}
                            color={c.brand.primary}
                        />
                    </View>
                    <View style={{ flexBasis: isSmall ? "47%" : "23%", flexGrow: 1, minWidth: 150 }}>
                        <StatCard
                            label={t("Activas")}
                            value={vm.stats.activeSchools}
                            icon={<Feather name="check-circle" size={20} color={c.status.success} />}
                            color={c.status.success}
                        />
                    </View>
                    <View style={{ flexBasis: isSmall ? "47%" : "23%", flexGrow: 1, minWidth: 150 }}>
                        <StatCard
                            label={t("Asistencia global")}
                            value={`${vm.stats.avgAttendance}%`}
                            icon={<Feather name="trending-up" size={20} color={c.status.info} />}
                            color={c.status.info}
                        />
                    </View>
                </View>

                {/* Búsqueda */}
                <SearchInput
                    value={vm.search}
                    onChangeText={vm.setSearch}
                    placeholder={t("Buscar sede por nombre, código o dirección...")}
                />

                {/* Lista de sedes */}
                {vm.schools.length === 0 ? (
                    <EmptyState
                        icon="map"
                        title={vm.search ? t("Sin resultados") : t("Aún no hay sedes")}
                        message={
                            vm.search
                                ? t("Intenta con otros criterios de búsqueda")
                                : t("Crea la primera sede para comenzar")
                        }
                        actionLabel={!vm.search && vm.canManage ? t("Nueva sede") : undefined}
                        onAction={!vm.search && vm.canManage ? vm.openCreate : undefined}
                    />
                ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                        {vm.schools.map((school) => (
                            <SchoolCard
                                key={school.schoolId}
                                school={school}
                                vm={vm}
                                t={t}
                                c={c}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>

            {vm.modalMode !== "none" && <SchoolFormModal vm={vm} t={t} c={c} />}

            <ConfirmModal
                visible={vm.statusTarget != null}
                onClose={vm.closeStatusConfirm}
                onConfirm={vm.confirmStatusChange}
                title={vm.statusTarget?.status ? t("Desactivar sede") : t("Activar sede")}
                message={
                    vm.statusTarget?.status
                        ? `${t("¿Desactivar")} ${vm.statusTarget?.name}? ${t(
                              "Dejará de estar disponible para nuevas operaciones."
                          )}`
                        : `${t("¿Activar")} ${vm.statusTarget?.name}?`
                }
                variant={vm.statusTarget?.status ? "danger" : "default"}
                confirmText={vm.statusTarget?.status ? t("Desactivar") : t("Activar")}
                cancelText={t("Cancelar")}
                loading={vm.isToggling}
            />
        </View>
    );
}
