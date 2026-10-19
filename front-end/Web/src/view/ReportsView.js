// ============================================================
//  FaceAttend EDU — ReportsView
//
//  Orquestador de reportes y sanciones.
//  Delega a componentes específicos según el rol del usuario y sección:
//  - Vista Padre: AdminReports (estudiantes en riesgo para notificar)
//  - Subsecciones: Históricos y Sanciones (delegadas según rol)
//
//  NOTA: La validación de autorización se hace GLOBALMENTE en
//  AuthenticatedNavigator. Este componente solo se renderiza
//  si el usuario YA está autorizado.
// ============================================================

import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { PageHeader, Button } from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useRolePermissions } from "../viewmodels/useRolePermissions";
import { AdminReports } from "./authorized/reports";

// ── Componente Orquestador ReportsView ───────────────────

export default function ReportsView({ section = null }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const permissions = useRolePermissions();
    const route = useRoute();
    const c = theme.colors;
    
    // Obtener parámetros de navegación
    const navigationParams = route.params || {};
    const navSection = navigationParams.section || section;
    const courseFilter = navigationParams.courseFilter;

    // Título dinámico según sección
    const pageTitle = navSection === "historicos" || navSection === "historical"
        ? t("Históricos")
        : navSection === "sanciones"
        ? t("Sanciones")
        : t("Reportes y Sanciones");

    // Determinar qué componente de reports renderizar según rol y sección
    let ReportsComponent;
    if (permissions.isAdmin || permissions.isTeacher) {
        // Admin y Teacher comparten la misma vista de reportes
        ReportsComponent = <AdminReports section={navSection} courseFilter={courseFilter} />;
    } else {
        // Los estudiantes no tienen acceso a reportes
        // Esto no debería llegar aquí por la validación en AuthMiddleware
        return null;
    }

    // Renderizar UI completa para usuarios autorizados
    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            {ReportsComponent}
        </View>
    );
}