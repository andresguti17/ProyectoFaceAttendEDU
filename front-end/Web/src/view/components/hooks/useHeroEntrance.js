import { useRef, useEffect } from "react";
import { Animated } from "react-native";

/**
 * Devuelve los valores animados para el fade+slide de entrada del Hero.
 * Se ejecuta una sola vez al montar el componente.
 */
export function useHeroEntrance() {
    const fadeLeft = useRef(new Animated.Value(0)).current;
    const slideLeft = useRef(new Animated.Value(-30)).current;
    const fadeRight = useRef(new Animated.Value(0)).current;
    const slideRight = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeLeft, {
                toValue: 1,
                duration: 800,
                delay: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideLeft, {
                toValue: 0,
                duration: 800,
                delay: 200,
                useNativeDriver: true,
            }),
            Animated.timing(fadeRight, {
                toValue: 1,
                duration: 800,
                delay: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideRight, {
                toValue: 0,
                duration: 800,
                delay: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeLeft, slideLeft, fadeRight, slideRight]);

    return { fadeLeft, slideLeft, fadeRight, slideRight };
}
