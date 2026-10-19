// ============================================================
//  FaceAttend EDU — Biometrics SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Orquestación y punto de entrada
//
//  ✓ Lee la sección de la ruta (/app/biometrics/:section?)
//  ✓ Cambia de sección actualizando la ruta (URL + sidebar quedan en sync)
//  ✓ Delega toda la presentación a BiometricsView
//
//  La autorización (admin/profesor) la aplica AuthenticatedNavigator
//  vía useRolePermissions.visibleTabs; aquí se re-valida para URLs directas.
// ============================================================

import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import BiometricsView from "../BiometricsView";
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";
import { normalizeBiometricSection } from "../../viewmodels/useBiometricsViewModel";

export default function BiometricsScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const permissions = useRolePermissions();

    if (!permissions.canEnrollOthersFace && !permissions.canRegisterFace) {
        return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
    }

    return (
        <BiometricsView
            section={normalizeBiometricSection(route.params?.section)}
            onSectionChange={(section) => navigation.setParams({ section })}
        />
    );
}
