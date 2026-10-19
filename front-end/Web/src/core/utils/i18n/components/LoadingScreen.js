// ============================================================
//  FaceAttend EDU — LoadingScreen (i18n · Component)
//
//  Pantalla de carga mostrada mientras se preparan las traducciones
//  de un nuevo idioma.
//
//  Se muestra cuando: isLoading === true
//  Se oculta cuando: isLoading === false
// ============================================================

import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

export function LoadingScreen() {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#39B54A" />
            <Text style={styles.text}>Cargando...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    text: {
        marginTop: 16,
        fontSize: 16,
        color: "#333333",
        fontWeight: "500",
    },
});
