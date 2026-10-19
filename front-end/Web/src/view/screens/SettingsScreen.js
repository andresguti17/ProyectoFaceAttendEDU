// ============================================================
//  FaceAttend EDU — Settings SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Orquestación y punto de entrada ("qué debe pasar")
//
//  Este componente:
//  ✓ Actúa como punto de entrada para la navegación
//  ✓ Delega toda la presentación a SettingsView
//
//  NO debe:
//  ✗ Contener lógica de negocio
//  ✗ Renderizar UI directamente (delegado a SettingsView)
//  ✗ Validar autorización (lo hace AuthenticatedNavigator GLOBALMENTE)
//
//  Patrón: Screen = orquestación, View = presentación
// ============================================================

import React from "react";
import { useRoute } from "@react-navigation/native";
import SettingsView from "../SettingsView";

export default function SettingsScreen() {
    const route = useRoute();
    const section = route.params?.section;
    
    // La validación de autorización se hace GLOBALMENTE en AuthenticatedNavigator
    // Este componente solo se renderiza si el usuario YA está autorizado
    
    return <SettingsView section={section} />;
}
