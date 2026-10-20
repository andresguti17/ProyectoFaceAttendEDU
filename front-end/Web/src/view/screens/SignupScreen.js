// ============================================================
//  FaceAttend EDU — Signup SCREEN
// ============================================================
//  RESPONSABILIDAD: Orquestación y Navegación ("qué debe pasar")
//
//  Este componente:
//  ✓ Maneja la navegación entre pantallas
//  ✓ Define callbacks de acciones (onRegisterSuccess, onGoToLogin, etc.)
//  ✓ Coordina flujos de navegación
//
//  NO debe:
//  ✗ Renderizar UI directamente
//  ✗ Contener lógica de presentación
//  ✗ Manejar estilos o layouts
//
//  La UI se delega completamente a SignupView.
// ============================================================

import React from "react";
import { useNavigation } from "@react-navigation/native";
import SignupView from "../SignupView";

export default function SignupScreen() {
    const navigation = useNavigation();

    // ── Navegación a login ────────────────────────────────────
    function onGoToLogin() {
        navigation.navigate("FaceAttendEDU-Login");
    }

    // ── Navegación al landing ─────────────────────────────────
    function onGoToLanding() {
        navigation.navigate("FaceAttendEDU");
    }

    // ── Delegación completa a View ────────────────────────────
    return (
        <SignupView
            onGoToLogin={onGoToLogin}
            onGoToLanding={onGoToLanding}
        />
    );
}
