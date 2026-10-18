// ============================================================
//  FaceAttend EDU — Academic SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Punto de entrada de la sección académica.
//  Delega toda la presentación a AcademicView.
// ============================================================

import React from "react";
import AcademicView from "../AcademicView";
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";

export default function AcademicScreen() {
    const permissions = useRolePermissions();
    if (!permissions.visibleTabs.includes("academic")) {
        return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
    }
    return <AcademicView />;
}
