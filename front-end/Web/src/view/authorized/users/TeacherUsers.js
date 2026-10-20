// ============================================================
//  FaceAttend EDU — TeacherUsers
//
//  Vista de usuarios para profesores/instructores.
//  Muestra solo los estudiantes matriculados en las fichas donde
//  el profesor es el instructor asignado (acotado en
//  useUsersViewModel vía instructorActorIds). Sin acciones de
//  gestión (crear/importar/editar son solo de admin).
// ============================================================

import React, { useMemo } from "react";
import { ScrollView, View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button } from "../../components/common";
import { useTheme } from "../../components/hooks/useTheme";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useUsersViewModel } from "../../../viewmodels/useUsersViewModel";
import { useRolePermissions } from "../../../viewmodels/useRolePermissions";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAppData } from "../../../context/AppDataContext";
import StudentDetailModal from "../../components/users/StudentDetailModal";
import { UsersFilterBar, UsersTable } from "./sections";
import { COLUMNS, createCompactRowConfig } from "./columns/usersColumns";

export function TeacherUsers({ vm: vmProp }) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const vmLocal = useUsersViewModel();
    const vm = vmProp || vmLocal;
    const { t } = useTranslation();
    const permissions = useRolePermissions();
    const appData = useAppData();

    const filterColumns = useMemo(
        () => [
            { key: "name", label: t("Nombre"), icon: "type" },
            { key: "attendance", label: t("Asistencia"), icon: "percent" },
            { key: "status", label: t("Estado"), icon: "activity" },
        ],
        [t]
    );

    // Se pinta solo la página actual (la consulta se limita a USERS_PAGE_SIZE
    // filas por render) y el resto se pagina en el cliente, como en AdminUsers.
    const users = vm.pageUsers ?? vm.filteredUsers;
    const isPaginated = (vm.totalPages ?? 1) > 1;
    const renderContext = { t, c, roleVariant: "default", courses: appData.courses, programMode: "curso" };
    // La lista ya está acotada a mis estudiantes: forzamos roleFilter para
    // ocultar la columna "Rol" (redundante, todos son estudiantes).
    const visibilityContext = { roleFilter: "student", canManage: false };
    const compactConfig = createCompactRowConfig({ showRole: false, canManage: false });
    // Con paginación el "final de la lista" sería engañoso: se informa
    // cuántos hay en la página actual sobre el total filtrado.
    const completeMessage = isPaginated
        ? `${t("Mostrando")} ${users.length} ${t("de")} ${vm.totalUsers} ${t("estudiantes")}`
        : t("Ya viste a todos tus estudiantes, no hay más por mostrar.");

    return (
        <ScrollView
            contentContainerStyle={{ padding: isSmall ? 16 : 24, gap: 16 }}
            showsVerticalScrollIndicator={false}
        >
            {/* Barra de filtros reutilizable */}
            <UsersFilterBar
                vm={vm}
                options={{
                    filterColumns,
                    searchPlaceholder: t("Buscar por nombre o código..."),
                    showCourseFilter: true,
                }}
            />

            {/* Tabla reutilizable */}
            <UsersTable
                columns={COLUMNS}
                data={users}
                onRowPress={(user) => vm.selectUser(user)}
                renderContext={renderContext}
                visibilityContext={visibilityContext}
                compactConfig={compactConfig}
                isLoading={vm.isLoading}
                loadingMessage={`${t("Cargando")} ${t("estudiantes")}...`}
                completeMessage={completeMessage}
                emptyState={{
                    icon: "users",
                    title: t("Sin estudiantes"),
                    description: t("Aún no tienes estudiantes en tus fichas asignadas"),
                }}
            />

            {/* Paginación: la consulta se limita a una página de la vez */}
            {isPaginated && (
                <View
                    style={{
                        flexDirection: isSmall ? "column" : "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                    }}
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={vm.page <= 0}
                        onPress={() => vm.setPage(Math.max(0, vm.page - 1))}
                        leftIcon={<Feather name="chevron-left" size={16} color={c.text.primary} />}
                    >
                        {t("Anterior")}
                    </Button>

                    <Text
                        style={{
                            fontSize: 13,
                            color: c.text.secondary,
                            textAlign: "center",
                        }}
                    >
                        {`${t("Página")} ${vm.page + 1} ${t("de")} ${vm.totalPages} · ${vm.totalUsers} ${t(
                            "estudiantes"
                        )}`}
                    </Text>

                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={vm.page >= vm.totalPages - 1}
                        onPress={() => vm.setPage(vm.page + 1)}
                        leftIcon={<Feather name="chevron-right" size={16} color={c.text.primary} />}
                    >
                        {t("Siguiente")}
                    </Button>
                </View>
            )}

            {/* Detalle de estudiante (solo lectura; registrar rostro sigue permitido) */}
            <StudentDetailModal
                student={vm.selected}
                onClose={vm.clearSelection}
                canManage={false}
                canRegisterFace={permissions.canRegisterFace}
                onBiometricsEnrolled={vm.markBiometrics}
            />
        </ScrollView>
    );
}

export default TeacherUsers;
