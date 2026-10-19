// ============================================================
//  FaceAttend EDU — StudentUsers
//
//  Vista de usuarios para estudiantes: solo sus compañeros de
//  ficha (misma cohort, excluyéndose a sí mismo — acotado en
//  useUsersViewModel vía courseId). Información limitada,
//  sin ninguna acción de gestión.
// ============================================================

import React, { useMemo } from "react";
import { ScrollView } from "react-native";
import { useTheme } from "../../components/hooks/useTheme";
import { useResponsive } from "../../components/hooks/useResponsive";
import { useUsersViewModel } from "../../../viewmodels/useUsersViewModel";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAppData } from "../../../context/AppDataContext";
import StudentDetailModal from "../../components/users/StudentDetailModal";
import { UsersFilterBar, UsersTable } from "./sections";
import { COLUMNS, createCompactRowConfig } from "./columns/usersColumns";

export function StudentUsers({ vm: vmProp }) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const vmLocal = useUsersViewModel();
    const vm = vmProp || vmLocal;
    const { t } = useTranslation();
    const appData = useAppData();

    const filterColumns = useMemo(
        () => [
            { key: "name", label: t("Nombre"), icon: "type" },
            { key: "status", label: t("Estado"), icon: "activity" },
        ],
        [t]
    );

    const users = vm.filteredUsers;
    const renderContext = { t, c, roleVariant: "default", courses: appData.courses };
    // La lista ya está acotada a mis compañeros de ficha: forzamos roleFilter
    // para ocultar la columna "Rol" (redundante, todos son estudiantes) y
    // canManage siempre en false (un estudiante nunca gestiona a otros).
    const visibilityContext = { roleFilter: "student", canManage: false };
    const compactConfig = createCompactRowConfig({ showRole: false, canManage: false });

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
                loadingMessage={`${t("Cargando")} ${t("compañeros")}...`}
                completeMessage={t("Esos son todos tus compañeros de ficha.")}
                emptyState={{
                    icon: "users",
                    title: t("Sin compañeros"),
                    description: t("No encontramos compañeros en tu ficha"),
                }}
            />

            {/* Detalle de compañero: solo lectura, sin gestión ni registro facial */}
            <StudentDetailModal
                student={vm.selected}
                onClose={vm.clearSelection}
                canManage={false}
                canRegisterFace={false}
            />
        </ScrollView>
    );
}

export default StudentUsers;
