// ============================================================
//  FaceAttend EDU — Courses SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Orquestación y punto de entrada ("qué debe pasar")
//
//  Este componente:
//  ✓ Actúa como punto de entrada para la navegación
//  ✓ Delega toda la presentación a CoursesView
//
//  NO debe:
//  ✗ Contener lógica de negocio
//  ✗ Renderizar UI directamente (delegado a CoursesView)
//
//  Patrón: Screen = orquestación, View = presentación
// ============================================================

import React from "react";
import CoursesView from "../CoursesView";
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";

export default function CoursesScreen() {
    const permissions = useRolePermissions();
    if (!permissions.visibleTabs.includes("courses")) {
        return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
    }
    return <CoursesView />;
}
