// ============================================================
//  FaceAttend EDU — AuthAnimatedLayout (View Layer)
//  Layout compartido para las pantallas de auth en desktop.
//
//  Animaciones:
//    · Panel de marca (izq)  → desliza desde la izquierda
//    · Panel de formulario   → desliza desde arriba
//
//  Centrado vertical estable (anti-salto):
//    useWindowDimensions provee la altura real de la ventana.
//    El formulario se centra con marginTop calculado:
//      (alturaPanel - alturaFormulario) / 2
//    Como ambas pantallas usan el mismo contenedor, el punto
//    de anclaje vertical es idéntico sin importar el nº de campos.
//
//  MVVM: componente puro de View. Sin lógica de negocio.
// ============================================================

import React from "react";
import {
    Animated,
    View,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { useTheme }         from "../hooks/useTheme";
import { useAuthAnimation } from "../hooks/useAuthAnimation";


export default function AuthAnimatedLayout({
    screenKey,
    brandPanel,
    formContent,
}) {
    const { theme }                 = useTheme();
    const c                         = theme.colors;
    const { brandStyle, formStyle } = useAuthAnimation(screenKey);
    const { height }                = useWindowDimensions();

    return (
        <SafeAreaProvider>
            <SafeAreaView style={[styles.root, { backgroundColor: c.background.app }]}>
                <View style={styles.row}>

                    {/* ── Panel de marca ─ desliza desde la izquierda ── */}
                    <Animated.View
                        style={[
                            styles.brandWrapper,
                            { backgroundColor: c.brand.primary },
                            brandStyle,
                        ]}
                    >
                        {brandPanel}
                    </Animated.View>

                    {/* ── Panel de formulario ─ desliza desde arriba ── */}
                    <Animated.View
                        style={[
                            styles.formWrapper,
                            { backgroundColor: c.background.surface },
                            formStyle,
                        ]}
                    >
                        {/*
                         * Por qué useWindowDimensions en lugar de flex:
                         *
                         * En RN Web, Animated.View genera un div sin altura
                         * CSS explícita. Los hijos con flex:1 no pueden calcular
                         * su alto porque el div padre no tiene height en el DOM.
                         * → flexGrow:1 + justifyContent:"center" no funciona.
                         *
                         * Solución: `height` real de la ventana como referencia.
                         * El ScrollView tiene maxHeight = windowHeight para que
                         * pueda hacer scroll si la ventana es muy baja, y su
                         * contentContainerStyle centra verticalmente usando
                         * minHeight + justifyContent:"center".
                         */}
                        <ScrollView
                            style={[styles.formScroll, { maxHeight: height }]}
                            contentContainerStyle={[
                                styles.formScrollContent,
                                { minHeight: height },
                            ]}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={styles.formInner}>
                                {formContent}
                            </View>
                        </ScrollView>
                    </Animated.View>

                </View>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    row: {
        flex: 1,
        flexDirection: "row",
    },

    // ── Panel de marca ────────────────────────────────────────
    brandWrapper: {
        flex: 1,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },

    // ── Panel de formulario ───────────────────────────────────
    formWrapper: {
        flex: 1,
        overflow: "hidden",
    },

    formScroll: {
        width: "100%",
    },

    // minHeight = windowHeight + justifyContent:"center"
    // es el patrón que funciona en RN Web cuando el contenedor
    // padre no tiene altura CSS explícita.
    formScrollContent: {
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 6,
        paddingVertical: 2,
    },

    formInner: {
        width: "100%",
        maxWidth: 460,
    },
});
