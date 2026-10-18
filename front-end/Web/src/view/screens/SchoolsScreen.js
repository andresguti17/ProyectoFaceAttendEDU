// ============================================================
//  FaceAttend EDU — Schools SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Punto de entrada de la sección Escuelas
//
//  Este componente:
//  ✓ Es el punto de entrada para navegación
//  ✓ Delega presentación a SchoolsView
//
//  NO debe:
//  ✗ Contener lógica de negocio
//  ✗ Renderizar UI directamente
//
//  Patrón: Screen = orquestación, View = presentación
// ============================================================

import React from "react";
import SchoolsView from "../SchoolsView";
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";

export default function SchoolsScreen() {
    const permissions = useRolePermissions();
    if (!permissions.visibleTabs.includes("schools")) {
        return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
    }
    return <SchoolsView />;
}
