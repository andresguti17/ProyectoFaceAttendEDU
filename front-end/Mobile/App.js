import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider, useTheme } from './src/view/components/common/ThemeContext';
import { AlertsConfigProvider } from './src/utils/AlertsConfigContext';
import { UserProvider } from './src/utils/UserContext';
import i18n from './src/utils/i18n';
import AppNavigator from './src/navigations/AppNavigator';

function AppContent() {
    const { isDark } = useTheme();

    return (
        <>
            <StatusBar style={isDark ? 'light' : 'dark'} />
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