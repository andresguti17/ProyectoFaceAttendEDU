
import React from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

// ── Importación de componentes de seguridad ───────────────────
import { NotAuthorized, AUTH_EXCEPTION_TYPES } from "../NotAuthorized";

// ── Importación de Hooks ──────────────────────────────────────
import { useTheme } from "../components/hooks/useTheme";
import { useAuth } from "../../context/AuthContext";
import { useRolePermissions } from "../../viewmodels/useRolePermissions";

// ── Importación de Layout Component ───────────────────────────
import AuthenticatedLayout from "./AuthenticatedLayout";

/**
 * AuthMiddleware - Higher Order Component para autenticación
 * 
 * Envuelve pantallas autenticadas con:
 * 1. Validación de autenticación/autorización
 * 2. Layout con sidebar y bottom tabs
 * 3. Manejo de estados de carga
 * 
 * @param {React.Component} ScreenComponent - Componente de pantalla a proteger
 * @returns {React.Component} - Componente protegido con layout
 */
export default function AuthMiddleware(ScreenComponent) {
    return function AuthenticatedScreen(props) {
        const { theme } = useTheme();
        const { user, sessionExpiredByTimeout, isLoadingTimeoutFlag } = useAuth();
        const permissions = useRolePermissions();
        const c = theme.colors;

        // ============================================================
        // VALIDACIÓN GLOBAL DE AUTORIZACIÓN
        // Si el usuario NO está autorizado, renderizar SOLO NotAuthorized
        // Esto previene que se renderice CUALQUIER layout (sidebar, tabs, etc.)
        // ============================================================
        
        // 1. Verificar sesión activa
        if (!user) {
            // Esperar a que termine de cargar el flag de timeout antes de decidir
            if (isLoadingTimeoutFlag) {
                return null; // o un spinner de carga
            }
            
            // Determinar si fue por timeout o porque nunca se logueó
            const errorType = sessionExpiredByTimeout 
                ? AUTH_EXCEPTION_TYPES.SESSION_EXPIRED 
                : AUTH_EXCEPTION_TYPES.NO_SESSION;
                
            return <NotAuthorized type={errorType} />;
        }
        
        // 2. Verificar rol asignado
        if (!user.role) {
            return <NotAuthorized type={AUTH_EXCEPTION_TYPES.NO_ROLE} />;
        }
        
        // 3. Verificar que el rol sea válido
        if (!permissions.isAdmin && !permissions.isTeacher && !permissions.isStudent) {
            return <NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />;
        }
        
        // ============================================================
        // USUARIO AUTORIZADO - Renderizar con layout autenticado
        // ============================================================
        
        return (
            <SafeAreaProvider>
                <SafeAreaView
                    style={{ flex: 1, backgroundColor: c.background.app }}
                    edges={["top", "bottom"]}
                >
                    <AuthenticatedLayout>
                        <ScreenComponent {...props} />
                    </AuthenticatedLayout>
                </SafeAreaView>
            </SafeAreaProvider>
        );
    };
}