import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';

// Botón volver estándar de la app: flecha superior izquierda.
// Unifica las variantes previas (botón inferior "Volver", texto "‹ Volver",
// recuadro con glifo) en un solo affordance.
export default function BackButton({ onPress, style }) {
    const { t } = useTranslation();
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            onPress={() => onPress?.()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[{ alignSelf: 'flex-start', padding: 6 }, style]}
        >
            <Image
                source={require('../../../assets/images/flecha-volver.png')}
                style={{ width: 26, height: 26, tintColor: colors.text }}
            />
        </TouchableOpacity>
    );
}
