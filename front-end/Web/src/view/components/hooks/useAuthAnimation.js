import { useEffect, useRef } from "react";
import { Animated, Easing, Platform } from "react-native";

/**
 * Genera los estilos animados de entrada para ambos paneles
 * de la pantalla de autenticación en desktop.
 *
 * @param key  - Clave única por pantalla (ej. "login" | "register").
 *               Al cambiar, la animación se reinicia para la nueva pantalla.
 */
export function useAuthAnimation(key) {
    // ── Panel de marca: entra desde la IZQUIERDA (valor negativo) ─
    const brandTranslateX = useRef(new Animated.Value(-80)).current;
    const brandOpacity = useRef(new Animated.Value(0)).current;

    // ── Panel de formulario: entra desde arriba ───────────────
    const formTranslateY = useRef(new Animated.Value(-48)).current;
    const formOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Web no soporta el driver nativo: el estado inicial (opacity 0)
        // pintaba el login a medias y parecía roto mientras el bundle
        // estático arrancaba. En web se renderiza directamente en reposo.
        if (Platform.OS === "web") {
            brandTranslateX.setValue(0);
            brandOpacity.setValue(1);
            formTranslateY.setValue(0);
            formOpacity.setValue(1);
            return;
        }

        // Reiniciar valores al cambiar de pantalla
        brandTranslateX.setValue(-80);
        brandOpacity.setValue(0);
        formTranslateY.setValue(-48);
        formOpacity.setValue(0);

        const EASING = Easing.out(Easing.cubic);
        const DURATION_BRAND = 480;
        const DURATION_FORM = 420;
        const DELAY_FORM = 60; // leve desfase para efecto en cascada

        Animated.parallel([
            // Panel de marca
            Animated.timing(brandTranslateX, {
                toValue: 0,
                duration: DURATION_BRAND,
                easing: EASING,
                useNativeDriver: true,
            }),
            Animated.timing(brandOpacity, {
                toValue: 1,
                duration: DURATION_BRAND,
                easing: EASING,
                useNativeDriver: true,
            }),

            // Panel de formulario (con leve delay)
            Animated.sequence([
                Animated.delay(DELAY_FORM),
                Animated.parallel([
                    Animated.timing(formTranslateY, {
                        toValue: 0,
                        duration: DURATION_FORM,
                        easing: EASING,
                        useNativeDriver: true,
                    }),
                    Animated.timing(formOpacity, {
                        toValue: 1,
                        duration: DURATION_FORM,
                        easing: EASING,
                        useNativeDriver: true,
                    }),
                ]),
            ]),
        ]).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return {
        brandStyle: {
            transform: [{ translateX: brandTranslateX }],
            opacity: brandOpacity,
        },
        formStyle: {
            transform: [{ translateY: formTranslateY }],
            opacity: formOpacity,
        },
    };
}
