// ============================================================
//  FaceAttend EDU — Justifications SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Orquestación y punto de entrada ("qué debe pasar")
//
//  ✓ Actúa como punto de entrada para la navegación
//  ✓ Delega toda la presentación a JustificationsView
//
//  Patrón: Screen = orquestación, View = presentación
// ============================================================

import React from "react";
import JustificationsView from "../JustificationsView";
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";

export default function JustificationsScreen() {
    const permissions = useRolePermissions();
    if (!permissions.visibleTabs.includes("justifications")) {
        return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
    }
    return <JustificationsView />;
}
