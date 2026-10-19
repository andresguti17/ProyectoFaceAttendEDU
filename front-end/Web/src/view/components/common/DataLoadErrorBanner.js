// ============================================================
//  FaceAttend EDU — DataLoadErrorBanner
//
//  Aviso no bloqueante cuando el backend no respondió y las
//  listas (estudiantes, cursos, usuarios...) quedaron vacías.
//  Evita que un dato falso de respaldo pase por real.
// ============================================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useAppData } from "../../../context/AppDataContext";

export function DataLoadErrorBanner() {
    const { loadError } = useAppData();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    if (!loadError) return null;

    return (
        <View style={[styles.container, { backgroundColor: c.status.errorLight, borderColor: c.status.error }]}>
            <Feather name="alert-triangle" size={16} color={c.status.error} />
            <Text style={[styles.text, { color: c.status.error }]}>
                {t("No se pudieron cargar los datos del servidor")}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    text: {
        fontSize: 13,
        fontWeight: "600",
    },
});

export default DataLoadErrorBanner;
