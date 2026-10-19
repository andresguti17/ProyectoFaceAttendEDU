// ============================================================
//  FaceAttend EDU — LoadingView
//
//  Vista de carga bloqueante global.
//  
//  Casos de uso:
//  - Cambio de idioma (ES → EN, FR, DE, PT)
//  - Cualquier estado de carga que requiera bloquear la UI
//
//  Renderiza:
//  - Logo de FaceAttend EDU en el centro
//  - Indicador de carga animado
//  - Mensaje opcional de estado
// ============================================================

import React from "react";
import { View, Text, Image, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "./components/hooks/useTheme";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";

/**
 * LoadingView - Vista de carga bloqueante global
 * 
 * @param {string} message - Mensaje opcional a mostrar (será traducido)
 */
export function LoadingView({ message = "Cargando..." }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    return (
        <View style={[styles.container, { backgroundColor: c.background.primary }]}>
            {/* Logo */}
            <Image
                source={require("../assets/images/logoFaceAttend.svg")}
                style={styles.logo}
                resizeMode="contain"
            />

            {/* Indicador de carga */}
            <ActivityIndicator 
                size="large" 
                color={c.brand.primary} 
                style={styles.spinner}
            />

            {/* Mensaje traducido */}
            <Text style={[styles.message, { color: c.text.secondary }]}>
                {t(message)}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999999,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 999999, // Para Android
    },
    logo: {
        width: 200,
        height: 200,
        marginBottom: 32,
        opacity: 0.9,
    },
    spinner: {
        marginBottom: 16,
    },
    message: {
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 300,
    },
});

export default LoadingView;
