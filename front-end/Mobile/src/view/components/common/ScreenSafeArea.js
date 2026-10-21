import React, {useEffect} from 'react';
import {StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {setStatusBarStyle} from 'expo-status-bar';
import {useIsFocused} from '@react-navigation/native';
import {useTheme} from './ThemeContext';

// ¿Fondo claro? Luminancia relativa WCAG; por encima de 0.179 los iconos negros contrastan mejor.
// Colores que no son #rgb/#rrggbb se tratan como oscuros (iconos claros).
export function isLightColor(color) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color ?? '')) return false;
    const full = color.length === 4 ? color.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : color;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179;
}

// SafeAreaView de cada pantalla: su fondo también pinta la franja de la barra de
// estado, y los iconos (claros u oscuros) se eligen para contrastar con ese fondo.
export default function ScreenSafeArea({style, ...props}) {
    const {colors} = useTheme();
    const isFocused = useIsFocused();
    const flat = StyleSheet.flatten([{backgroundColor: colors.background}, style]);
    const isLightBackground = isLightColor(flat.backgroundColor);

    // Solo la pantalla con foco fija el estilo: las de debajo del stack no deben pisarlo.
    useEffect(() => {
        if (isFocused) setStatusBarStyle(isLightBackground ? 'dark' : 'light');
    }, [isFocused, isLightBackground]);

    return <SafeAreaView edges={['top']} style={[{backgroundColor: colors.background}, style]} {...props} />;
}
