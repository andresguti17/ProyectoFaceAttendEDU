// ============================================================
//  FaceAttend EDU — Login SCREEN
// ============================================================
//  RESPONSABILIDAD: Orquestación y Navegación ("qué debe pasar")
//
//  Este componente:
//  ✓ Maneja la navegación entre pantallas
//  ✓ Define callbacks de acciones (onLoginSuccess, onForgotPassword, etc.)
//  ✓ Coordina flujos de navegación
//
//  NO debe:
//  ✗ Renderizar UI directamente
//  ✗ Contener lógica de presentación
//  ✗ Manejar estilos o layouts
//
//  La UI se delega completamente a LoginView.
// ============================================================

import React from "react";
import { useNavigation } from "@react-navigation/native";
import LoginView from "../LoginView";
import { useAuth } from "../../context/AuthContext";

export default function LoginScreen() {
    const navigation = useNavigation();
    const { clearIntendedRoute } = useAuth();

    // ── Navegación post-login exitoso ────────────────────────
    function onLoginSuccess(redirectRoute = null) {
        console.log('[LoginScreen] Login success callback:', { redirectRoute });
        
        if (redirectRoute) {
            console.log('[LoginScreen] Navigating with redirect to:', redirectRoute.name);
            navigation.replace(redirectRoute.name, redirectRoute.params);
        } else {
            console.log('[LoginScreen] Navigating to dashboard (no redirect)');
            navigation.replace("Dashboard");
        }
    }

    // ── Navegación a recuperación de contraseña ──────────────
    function onForgotPassword() {
        navigation.navigate("FaceAttendEDU-Recovery");
    }

    // ── Navegación a registro ─────────────────────────────────
    function onGoToRegister() {
        clearIntendedRoute();
        navigation.navigate("FaceAttendEDU-Register");
    }

    // ── Navegación de regreso al landing ──────────────────────
    function onGoToLanding() {
        clearIntendedRoute();
        navigation.navigate("FaceAttendEDU");
    }

    // ── Delegación completa a View ────────────────────────────
    return (
        <LoginView
            onLoginSuccess={onLoginSuccess}
            onForgotPassword={onForgotPassword}
            onGoToRegister={onGoToRegister}
            onGoToLanding={onGoToLanding}
        />
    );
}
