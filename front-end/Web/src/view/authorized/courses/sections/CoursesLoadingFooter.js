// ============================================================
//  FaceAttend EDU — CoursesLoadingFooter
//
//  Footer persistente para la tabla de cursos.
//  
//  Muestra:
//  - Estado de carga con spinner y mensaje
//  - Mensaje de finalización cuando no hay más datos
//
//  Se mantiene siempre visible en la tabla cuando hay datos.
// ============================================================

import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../../components/hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * CoursesLoadingFooter - Footer persistente para la tabla
 * 
 * @param {boolean} isLoading - Si está cargando
 * @param {string} loadingMessage - Mensaje mientras carga
 * @param {string} completeMessage - Mensaje cuando terminó
 */
export default function CoursesLoadingFooter({
    isLoading = false,
    loadingMessage = "Cargando cursos...",
    completeMessage = "¡Ya llegaste hasta el final de la lista!",
}) {
    const { theme } = useTheme();
    const c = theme.colors;

    return (
        <View
            style={[
                styles.footer,
                {
                    borderTopColor: c.border.primary,
                    backgroundColor: c.background.app,
                },
            ]}
        >
            {isLoading ? (
                // Estado de carga
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={c.brand.primary} />
                    <Text style={[styles.message, { color: c.text.secondary }]}>
                        {loadingMessage}
                    </Text>
                </View>
            ) : (
                // Estado completo
                <View style={styles.completeContainer}>
                    <Feather name="check-circle" size={16} color={c.status.success} />
                    <Text style={[styles.message, { color: c.text.secondary }]}>
                        {completeMessage}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    footer: {
        borderTopWidth: 1,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        alignItems: "center",
        justifyContent: "center",
    },
    loadingContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: DESIGN_TOKENS.spacing.sm,
    },
    completeContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: DESIGN_TOKENS.spacing.sm,
    },
    message: {
        fontSize: 13,
        fontWeight: "500",
    },
});
