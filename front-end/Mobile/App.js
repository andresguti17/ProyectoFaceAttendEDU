import React, { useEffect } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from './src/view/components/common/ThemeContext';
import { AlertsConfigProvider } from './src/utils/AlertsConfigContext';
import { UserProvider } from './src/utils/UserContext';
import i18n from './src/utils/i18n';
import AppNavigator from './src/navigations/AppNavigator';

// Oculta los botones de navegación de Android (modo inmersivo). El sistema los vuelve a mostrar
// al abrir el teclado o al volver a la app, así que se ocultan de nuevo en esos dos eventos.
const hideNavigationBar = () => NavigationBar.setVisibilityAsync('hidden').catch(() => {});

function AppContent() {

    useEffect(() => {
        if (Platform.OS !== 'android') return undefined;
        hideNavigationBar();
        const appState = AppState.addEventListener('change', (state) => state === 'active' && hideNavigationBar());
        const keyboard = Keyboard.addListener('keyboardDidHide', hideNavigationBar);
        return () => {
            appState.remove();
            keyboard.remove();
        };
    }, []);

    return (
        <>
            <I18nextProvider i18n={i18n}>
                <UserProvider>
                    <AppNavigator />
                </UserProvider>
            </I18nextProvider>
        </>
    );
}

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <AlertsConfigProvider>
                    <ThemeProvider>
                        <AppContent />
                    </ThemeProvider>
                </AlertsConfigProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}