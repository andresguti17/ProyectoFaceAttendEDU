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

    // ── Navegación post-registro exitoso ──────────────────────
    function onRegisterSuccess(data) {
        console.log("Registro exitoso:", data.email);
        
        // El registro ya se maneja en el ViewModel
        // Por diseño, signup SIEMPRE va al Dashboard (sin redirección guardada)
        navigation.replace("Dashboard");
    }

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
            onRegisterSuccess={onRegisterSuccess}
            onGoToLogin={onGoToLogin}
            onGoToLanding={onGoToLanding}
        />
    );
}
