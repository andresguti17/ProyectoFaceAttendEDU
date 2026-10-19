// ============================================================
//  FaceAttend EDU — Dashboard SCREEN (Container)
// ============================================================
//  RESPONSABILIDAD: Punto de entrada para la pantalla Dashboard
//
//  Este componente:
//  ✓ Actúa como punto de entrada para Dashboard
//  ✓ Delega toda la presentación a DashboardView
//
//  NO debe:
//  ✗ Contener lógica de negocio
//  ✗ Contener Sidebar/BottomTabs (eso es AuthenticatedLayout)
//  ✗ Renderizar otras pantallas
//
//  Patrón: Screen = orquestación, View = presentación
// ============================================================

import React from "react";
import { useNavigation } from "@react-navigation/native";
import DashboardView from "../DashboardView";

export default function DashboardScreen() {
    const navigation = useNavigation();
    return <DashboardView navigation={navigation} />;
}
