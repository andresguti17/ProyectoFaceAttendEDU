// ============================================================
//  FaceAttend EDU — Password Strength Indicator
// ============================================================
//  Indicador visual reutilizable de fortaleza de contraseña
//
//  Muestra:
//  ✓ Barra de progreso colorida
//  ✓ Nivel textual (Débil, Media, Fuerte, Muy fuerte)
//  ✓ Lista de requisitos con checks
// ============================================================

import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { 
    getPasswordStrength, 
    getPasswordStrengthLevel 
} from "../../../core/utils/validation";

/**
 * Indicador de fortaleza de contraseña
 * @param {string} password - Contraseña a evaluar
 * @param {boolean} show - Si debe mostrarse
 */
export default function PasswordStrengthIndicator({ password, show = false }) {
    const { theme } = useTheme();
    const c = theme.colors;

    if (!show) return null;

    const strength = password ? getPasswordStrength(password) : 0;
    const { level, color } = getPasswordStrengthLevel(strength);

    // Requisitos de la contraseña con su estado
    const requirements = [
        { test: password && password.length >= 8, label: "Mínimo 8 caracteres", key: "length" },
        { test: password && /[A-Z]/.test(password), label: "1 mayúscula", key: "upper" },
        { test: password && /[a-z]/.test(password), label: "1 minúscula", key: "lower" },
        { test: password && /[0-9]/.test(password), label: "1 número", key: "number" },
        { test: password && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), label: "1 carácter especial", key: "special" },
    ];

    return (
        <View style={styles.container}>
            {/* Barra de fortaleza */}
            <View style={styles.strengthBar}>
                <View style={[styles.barBackground, { backgroundColor: c.border.primary }]}>
                    <View 
                        style={[
                            styles.barFill, 
                            { 
                                width: `${strength}%`,
                                backgroundColor: color,
                            }
                        ]} 
                    />
                </View>
                <Text style={[styles.strengthText, { color }]}>
                    {level}
                </Text>
            </View>

            {/* Lista de requisitos con animación de tachado - NO cumplidos en ROJO */}
            <View style={styles.requirements}>
                {requirements.map((req) => (
                    <RequirementItem 
                        key={req.key}
                        requirement={req}
                        colors={c}
                    />
                ))}
            </View>
        </View>
    );
}

/**
 * Item individual de requisito con animación de tachado y colapso
 */
function RequirementItem({ requirement, colors }) {
    // Estado de completado local
    const [isCompleted, setIsCompleted] = React.useState(requirement.test);
    const [shouldRender, setShouldRender] = React.useState(true);
    
    // Inicializar animaciones según el estado INICIAL del requisito
    const fadeAnim = React.useRef(new Animated.Value(requirement.test ? 0.3 : 1)).current;
    const heightAnim = React.useRef(new Animated.Value(requirement.test ? 0 : 1)).current;

    React.useEffect(() => {
        if (requirement.test && !isCompleted) {
            // Se cumple → tachar, colapsar y eliminar
            setIsCompleted(true);
            
            Animated.sequence([
                // Fase 1: Fade out (tachado visible)
                Animated.timing(fadeAnim, {
                    toValue: 0.3,
                    duration: 300,
                    useNativeDriver: false,
                }),
                // Fase 2: Colapsar altura
                Animated.timing(heightAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: false,
                }),
            ]).start(() => {
                // Callback: una vez terminada la animación, dejar de renderizar
                setShouldRender(false);
            });
            
        } else if (!requirement.test && isCompleted) {
            // Ya no se cumple → restaurar (re-aparecer)
            setShouldRender(true);
            setIsCompleted(false);
            
            Animated.parallel([
                Animated.timing(heightAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                }),
            ]).start();
        }
    }, [requirement.test, isCompleted, fadeAnim, heightAnim]);

    // Si NO debe renderizarse, retornar null (completamente eliminado del DOM)
    if (!shouldRender) {
        return null;
    }

    const animatedHeight = heightAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 22],
    });

    const marginBottom = heightAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 6],
    });

    return (
        <Animated.View 
            style={[
                styles.requirement,
                { 
                    height: animatedHeight,
                    marginBottom: marginBottom,
                    opacity: fadeAnim,
                    overflow: 'hidden',
                }
            ]}
        >
            <Feather 
                name={isCompleted ? "check-circle" : "alert-circle"} 
                size={14} 
                color={isCompleted ? colors.status.success : colors.status.error} 
            />
            <View style={{ flex: 1 }}>
                <Text style={[
                    styles.requirementText,
                    { 
                        color: isCompleted ? colors.status.success : colors.status.error,
                        textDecorationLine: isCompleted ? 'line-through' : 'none',
                    }
                ]}>
                    {requirement.label}
                </Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        gap: 10,
    },
    strengthBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    barBackground: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: "hidden",
    },
    barFill: {
        height: "100%",
        borderRadius: 2,
        transition: "width 0.3s ease",
    },
    strengthText: {
        fontSize: 12,
        fontWeight: "600",
        minWidth: 70,
        textAlign: "center",
    },
    requirements: {
        gap: 6,
    },
    requirement: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    requirementText: {
        fontSize: 11,
        lineHeight: 16,
    },
});
