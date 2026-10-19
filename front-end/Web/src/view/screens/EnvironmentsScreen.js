// ============================================================
//  FaceAttend EDU — Environments SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Orquestación y punto de entrada ("qué debe pasar")
//
//  Este componente:
//  ✓ Actúa como punto de entrada para la navegación
//  ✓ Delega toda la presentación a EnvironmentsView
//
//  NO debe:
//  ✗ Contener lógica de negocio
//  ✗ Renderizar UI directamente (delegado a EnvironmentsView)
//
//  Patrón: Screen = orquestación, View = presentación
// ============================================================

import React from "react";
import EnvironmentsView from "../EnvironmentsView";
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";

export default function EnvironmentsScreen() {
    const permissions = useRolePermissions();
    if (!permissions.visibleTabs.includes("environments")) {
        return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
    }
    return <EnvironmentsView />;
}
