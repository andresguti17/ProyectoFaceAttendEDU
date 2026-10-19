// ============================================================
//  FaceAttend EDU — History SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Orquestación y punto de entrada ("qué debe pasar")
//
//  ✓ Actúa como punto de entrada para la navegación
//  ✓ Delega toda la presentación a HistoryView
//
//  Patrón: Screen = orquestación, View = presentación
// ============================================================

import React from "react";
import HistoryView from "../HistoryView";
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";

export default function HistoryScreen() {
    const permissions = useRolePermissions();
    if (!permissions.visibleTabs.includes("history")) {
        return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
    }
    return <HistoryView />;
}
