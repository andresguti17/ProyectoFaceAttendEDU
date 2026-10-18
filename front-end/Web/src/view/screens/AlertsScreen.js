// ============================================================
//  FaceAttend EDU — Alerts SCREEN (Container)
// ============================================================

import React from "react";
import AlertsView from "../AlertsView";
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";

export default function AlertsScreen() {
    const permissions = useRolePermissions();
    if (!permissions.visibleTabs.includes("alerts")) {
        return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
    }
    return <AlertsView />;
}
