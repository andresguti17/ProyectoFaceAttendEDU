// ============================================================
//  FaceAttend EDU — AttendanceKiosk SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Punto de entrada y gate de autorización
//
//  ✓ Valida permisos (admin/profesor), igual que BiometricsScreen
//  ✓ Delega toda la presentación a AttendanceKioskView
// ============================================================

import React from "react";
import AttendanceKioskView from "../AttendanceKioskView";
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";

export default function AttendanceKioskScreen() {
    const permissions = useRolePermissions();

    // canManageSessions es el permiso canónico (scheduling.session:manage);
    // se acepta canRegisterFace como fallback por compatibilidad.
    if (!permissions.canManageSessions && !permissions.canRegisterFace) {
        return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
    }

    return <AttendanceKioskView />;
}
