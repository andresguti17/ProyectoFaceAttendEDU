import React, { useMemo } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../common/ThemeContext';
import { createAuthStyles } from './style/Style';

// Botón volver de pie de pantalla: mismo formato que DangerButton (ancho completo,
// al final del contenido). Sin onPress vuelve a la pantalla anterior.
export default function ReturnButton({ onPress, disabled = false, inset = true }) {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styleAuth = useMemo(() => createAuthStyles(colors), [colors]);

    const handlePress = () => (onPress ? onPress() : navigation.goBack());

    return (
        // Pie de pantalla fijo: neutral (nunca el color de las acciones como guardar) y siempre visible sin hacer scroll.
        <View style={[styleAuth.dangerButtonContainer, { paddingTop: 20, paddingBottom: 20, paddingHorizontal: inset ? 20 : 0 }]}>
            <TouchableOpacity
                style={[styleAuth.dangerButton, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, disabled && styleAuth.buttonDisabled]}
                onPress={handlePress}
                disabled={disabled}
                activeOpacity={0.7}
                accessibilityRole="button"
            >
                <Text style={[styleAuth.dangerButtonText, { color: colors.text }]}>{t('common.back')}</Text>
            </TouchableOpacity>
        </View>
    );
}
