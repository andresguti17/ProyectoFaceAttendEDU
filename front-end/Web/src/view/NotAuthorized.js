// ============================================================
//  FaceAttend EDU — NotAuthorized
//
//  Componente de seguridad BLOQUEANTE para excepciones de autorización.
//  Muestra modal personalizado que bloquea TODA interacción.
//  
//  Casos de uso:
//  - Usuario sin sesión activa → MODAL + redirect a login
//  - Sesión caducada → MODAL + redirect a login
//  - Sin rol asignado → MODAL + redirect a login
//  - Token JWT inválido → MODAL + redirect a login
//
//  Renderiza SOLO:
//  - Fondo con logo de FaceAttend EDU
//  - Modal bloqueante personalizado
//  - Overlay oscuro que cubre toda la pantalla
// ============================================================

import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "./components/hooks/useTheme";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";

/**
 * Tipos de excepciones de autorización
 */
export const AUTH_EXCEPTION_TYPES = {
    NO_SESSION: "no_session",           // Usuario no ha iniciado sesión
    SESSION_EXPIRED: "session_expired", // Sesión caducada
    NO_ROLE: "no_role",                // Usuario sin rol asignado
    INVALID_TOKEN: "invalid_token",     // Token JWT inválido (futuro)
    INSUFFICIENT_PERMISSIONS: "insufficient_permissions", // Rol sin permisos
};

/**
 * NotAuthorized - Componente BLOQUEANTE para excepciones de autorización
 * 
 * COMPORTAMIENTO:
 * 1. Muestra logo de FaceAttend EDU en el fondo (centro)
 * 2. Overlay oscuro que cubre toda la pantalla
 * 3. Alert compacto tipo banner en la parte superior con animación
 * 4. Al aceptar, redirije automáticamente a login
 * 5. NO permite ninguna otra interacción
 * 
 * @param {string} type - Tipo de excepción (ver AUTH_EXCEPTION_TYPES)
 * @param {function} onRedirect - Callback opcional (si no se provee, usa navegación por defecto)
 */
export function NotAuthorized({ 
    type = AUTH_EXCEPTION_TYPES.NO_SESSION,
    onRedirect,
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const navigation = useNavigation();
    const c = theme.colors;
    const [showModal, setShowModal] = useState(false);
    
    // Animación de entrada (slide down from top)
    const slideAnim = React.useMemo(() => new Animated.Value(-100), []);

    // Mostrar modal después de montar (para que se vea el logo primero)
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowModal(true);
            // Animar entrada
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 65,
                friction: 8,
                useNativeDriver: true,
            }).start();
        }, 100); // Pequeño delay para mostrar el logo primero

        return () => clearTimeout(timer);
    }, [slideAnim]);

    // Obtener configuración del modal según tipo de excepción
    const getModalConfig = () => {
        switch (type) {
            case AUTH_EXCEPTION_TYPES.NO_SESSION:
                return {
                    icon: "lock",
                    iconColor: c.status.warning,
                    title: t("Sesión no iniciada"),
                    message: t("Debes iniciar sesión para acceder a esta función."),
                };
            
            case AUTH_EXCEPTION_TYPES.SESSION_EXPIRED:
                return {
                    icon: "clock",
                    iconColor: c.status.warning,
                    title: t("Sesión caducada"),
                    message: t("Tu sesión expiró por inactividad. Por seguridad, debes iniciar sesión nuevamente."),
                };
            
            case AUTH_EXCEPTION_TYPES.NO_ROLE:
                return {
                    icon: "alert-triangle",
                    iconColor: c.status.error,
                    title: t("Rol no asignado"),
                    message: t("Tu cuenta no tiene un rol asignado. Contacta al administrador."),
                };
            
            case AUTH_EXCEPTION_TYPES.INVALID_TOKEN:
                return {
                    icon: "shield-off",
                    iconColor: c.status.error,
                    title: t("Token inválido"),
                    message: t("Tu sesión es inválida. Inicia sesión nuevamente."),
                };
            
            case AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS:
                return {
                    icon: "shield",
                    iconColor: c.status.warning,
                    title: t("Acceso denegado"),
                    message: t("No tienes los permisos necesarios para acceder aquí."),
                };
            
            default:
                return {
                    icon: "alert-circle",
                    iconColor: c.status.error,
                    title: t("Error de autenticación"),
                    message: t("Ocurrió un error con tu sesión. Inicia sesión nuevamente."),
                };
        }
    };

    const config = getModalConfig();

    const handleAccept = () => {
        if (onRedirect) {
            // Usar callback personalizado si se proporciona
            onRedirect();
        } else {
            // Navegar a login sin destruir el stack - usar navigate en lugar de reset
            navigation.navigate('FaceAttendEDU-Login');
        }
    };

    return (
        <View style={styles.container}>
            {/* Logo de fondo - MÁS GRANDE Y VISIBLE */}
            <Image
                source={require("../assets/images/logoFaceAttend.svg")}
                style={styles.backgroundLogo}
                resizeMode="contain"
            />

            {/* Alert compacto tipo banner */}
            {showModal && (
                <>
                    {/* Overlay oscuro */}
                    <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]} />
                    
                    {/* Alert animado */}
                    <Animated.View 
                        style={[
                            styles.alert, 
                            { 
                                backgroundColor: c.background.surface,
                                borderColor: c.border.primary,
                                transform: [{ translateY: slideAnim }],
                            }
                        ]}
                    >
                        {/* Contenedor horizontal: icono + texto + botón */}
                        <View style={styles.alertContent}>
                            {/* Icono a la izquierda */}
                            <View style={[styles.iconContainer, { 
                                backgroundColor: config.iconColor + '15' 
                            }]}>
                                <Feather 
                                    name={config.icon} 
                                    size={20} 
                                    color={config.iconColor} 
                                />
                            </View>

                            {/* Texto en el centro */}
                            <View style={styles.textContainer}>
                                <Text style={[styles.title, { color: c.text.primary }]}>
                                    {config.title}
                                </Text>
                                <Text style={[styles.message, { color: c.text.secondary }]}>
                                    {config.message}
                                </Text>
                            </View>

                            {/* Botón a la derecha */}
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: c.brand.primary }]}
                                onPress={handleAccept}
                                activeOpacity={0.8}
                            >
                                <Feather name="log-in" size={14} color={c.brand.textOnPrimary} />
                                <Text style={[styles.buttonText, { color: c.brand.textOnPrimary }]}>
                                    {t("Iniciar sesión")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backgroundLogo: {
        position: 'absolute',
        width: 300,
        height: 300,
        opacity: 0.1,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999998,
    },
    alert: {
        position: 'absolute',
        top: 80, // Posicionado arriba para ver el logo abajo
        left: '50%',
        marginLeft: -320, // Centrar (width/2)
        zIndex: 999999,
        width: 640,
        maxWidth: '90%',
        borderRadius: 12,
        borderWidth: 1,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 16,
    },
    alertContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    textContainer: {
        flex: 1,
        gap: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 20,
    },
    message: {
        fontSize: 13,
        lineHeight: 18,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8,
        flexShrink: 0,
    },
    buttonText: {
        fontSize: 13,
        fontWeight: '600',
    },
});

export default NotAuthorized;
