import React, { useMemo } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../common/ThemeContext';
import { createAuthStyles } from './style/Style';
import { useCustomAlert } from '../common/useCustomAlert';
import CustomAlert from '../common/CustomAlert';
import { removeToken } from "../../storage/TokenStorage";

export default function DangerButton({ title, disabled = false, onLogout }) {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styleAuth = useMemo(() => createAuthStyles(colors), [colors]);
    const { alertConfig, hideAlert, showError } = useCustomAlert();

    const handleLogout = async () => {
        try {
            // Limpiar almacenamiento
            await removeToken();
            await AsyncStorage.multiRemove(['userRole', 'userEmail', 'userProfile', 'appLanguage', 'alertsConfig']);

            // Ejecutar callback (que ya incluye la confirmación desde la pantalla)
            if (onLogout) {
                await onLogout();
            } else {
                const routeNames = navigation.getState?.()?.routeNames ?? [];
                const target = routeNames.includes('HomesScreen')
                    ? 'HomesScreen'
                    : routeNames.includes('DashboardScreen')
                        ? 'DashboardScreen'
                        : null;
                if (target) {
                    navigation.reset({ index: 0, routes: [{ name: target }] });
                }
            }
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            showError(t('common.error'), t('logout.error'), hideAlert);
        }
    };

    return (
        <>
            <View style={styleAuth.dangerButtonContainer}>
                <TouchableOpacity
                    style={[styleAuth.dangerButton, disabled && styleAuth.buttonDisabled]}
                    onPress={handleLogout}
                    disabled={disabled}
                    activeOpacity={0.7}
                >
                    <Text style={styleAuth.dangerButtonText}>{title || t('common.logout')}</Text>
                </TouchableOpacity>
            </View>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                type={alertConfig.type}
                onClose={hideAlert}
            />
        </>
    );
}
