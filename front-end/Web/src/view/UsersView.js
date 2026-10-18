// ============================================================
//  FaceAttend EDU — UsersView
//
//  Orquestador de gestión de usuarios.
//  Delega a componentes específicos según el rol del usuario:
//  - AdminUsers: gestión completa de todos los usuarios (admin)
//  - TeacherUsers: gestión de estudiantes de sus cursos (teacher)
//  - StudentUsers: vista limitada de compañeros (student)
//
//  NOTA: La validación de autorización se hace GLOBALMENTE en
//  AuthenticatedNavigator. Este componente solo se renderiza
//  si el usuario YA está autorizado.
// ============================================================

import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { PageHeader, Button } from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useRolePermissions } from "../viewmodels/useRolePermissions";
import { useUsersViewModel } from "../viewmodels/useUsersViewModel";
import { AdminUsers, TeacherUsers, StudentUsers } from "./authorized/users";

export default function UsersView({ 
    section = "all", 
    attendanceFilter = null, 
    searchQuery = null,
    sortBy = null,
    sortOrder = null,
    filterColumn = null 
}) {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const permissions = useRolePermissions();
    const vm = useUsersViewModel(section, attendanceFilter, searchQuery, sortBy, sortOrder, filterColumn);
    const c = theme.colors;

    // Helper para obtener el label de la sección
    const getSectionLabel = (section) => {
        const labels = {
            students: t("estudiantes"),
            teachers: t("profesores"),
            admins: t("administradores"),
            all: t("usuarios"),
        };
        return labels[section] || labels.all;
    };
    
    // Helper para obtener el label singular de la sección
    const getSectionLabelSingular = (section) => {
        const labels = {
            students: t("estudiante"),
            teachers: t("profesor"),
            admins: t("administrador"),
            all: t("usuario"),
        };
        return labels[section] || labels.all;
    };

    // Título dinámico según el rol del usuario
    const pageTitle = permissions.getTabLabel("users") || t("Usuarios");

    // Subtitle dinámico: mantiene texto base, solo cambia contenido de paréntesis.
    // El verbo depende del rol (solo el admin gestiona; el resto consulta).
    const sectionLabel = getSectionLabel(section);
    const actionVerb = permissions.canManageStudents ? t("Gestiona") : t("Consulta");
    const pageSubtitle = vm.isLoading
        ? `${actionVerb} ${t("los usuarios del sistema")} (${t("Cargando")} ${sectionLabel}...)`
        : `${actionVerb} ${t("los usuarios del sistema")} (${vm.filteredUsers.length} ${
            vm.filteredUsers.length !== 1 
                ? `${sectionLabel} ${t("encontrados")}` 
                : `${sectionLabel.slice(0, -1)} ${t("encontrado")}` // Singular: quita la 's' final
        })`;
    
    // Texto dinámico del botón "Nuevo [sección]"
    const newButtonLabel = `${t("Nuevo")} ${getSectionLabelSingular(section)}`;

    // Determinar qué componente de users renderizar según rol
    let UsersComponent;
    if (permissions.isAdmin) {
        UsersComponent = <AdminUsers section={section} vm={vm} />;
    } else if (permissions.isTeacher) {
        UsersComponent = <TeacherUsers section={section} vm={vm} />;
    } else {
        UsersComponent = <StudentUsers section={section} vm={vm} />;
    }

    // Renderizar UI completa para usuarios autorizados
    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={pageTitle}
                subtitle={pageSubtitle}
                actions={
                    <>
                        {/* Importar — solo admin */}
                        {permissions.canImportStudents && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onPress={vm.openImportModal}
                                leftIcon={<Feather name="upload" size={16} color={c.text.secondary} />}
                            >
                                {t("Importar")}
                            </Button>
                        )}
                        {/* Nuevo usuario — solo admin */}
                        {permissions.canManageStudents && (
                            <Button 
                                variant="primary" 
                                size="sm" 
                                onPress={vm.openRegisterModal}
                                leftIcon={<Feather name="plus" size={16} color="#fff" />}
                            >
                                {newButtonLabel}
                            </Button>
                        )}
                    </>
                }
            />
            {UsersComponent}
        </View>
    );
}
