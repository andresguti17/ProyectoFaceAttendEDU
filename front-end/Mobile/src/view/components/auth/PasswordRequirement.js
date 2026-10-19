import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { createAuthStyles } from './style/Style';

/**
 * Componente de requisito de contraseña con animación
 */
export function PasswordRequirement({ met, label, colors }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const styleAuth = useMemo(() => createAuthStyles(colors), [colors]);

    useEffect(() => {
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 1.15,
                duration: 150,
                useNativeDriver: true
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true
            }),
        ]).start();
    }, [met, scaleAnim]);

    const iconColor = met ? colors.success : colors.textSecondary;
    const icon = met ? '✓' : '○';

    return (
        <View style={styleAuth.passwordReqRow}>
            <Animated.Text
                style={[
                    styleAuth.passwordReqIcon,
                    { color: iconColor, transform: [{ scale: scaleAnim }] },
                ]}
            >
                {icon}
            </Animated.Text>
            <Text
                style={[styleAuth.passwordReqText, { color: iconColor }]}
                accessibilityLabel={`${label}, ${met ? 'cumplido' : 'pendiente'}`}
            >
                {label}
            </Text>
        </View>
    );
}