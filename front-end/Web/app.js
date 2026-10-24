import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";

// Barras de scroll visibles en web (RN-web las oculta por defecto)
import "./src/core/utils/webScrollbars";

// Habilitar react-native-screens para mejor performance
enableScreens();

import { ThemeProvider }    from "./src/context/ThemeContext";
import { ResponsiveProvider } from "./src/context/ResponsiveContext";
import { LanguageProvider, useLanguageContext } from "./src/core/utils/i18n/context/LanguageContext";
import { AppDataProvider }  from "./src/context/AppDataContext";
import { AuthProvider }     from "./src/context/AuthContext";
import { PushNotificationProvider } from "./src/view/components/common/feedback/PushNotification";
import { getInstitutionConfig } from "./src/core/config/institutionConfig";
import { DataLoadErrorBanner } from "./src/view/components/common/DataLoadErrorBanner";
import AppNavigator from "./src/navegation/appNavigator";
import { linkingConfig } from "./src/navegation/linking.config";
import LoadingView from "./src/view/LoadingView";

// Wrapper interno para acceder al contexto de idioma
function AppContent() {
    const { t, isLoading } = useLanguageContext();

    // Obtener configuración dinámica para las notificaciones
    const config = getInstitutionConfig();

    // Callback cuando el linking está listo
    const onReady = () => {
        console.log("🔗 Navigation ready with deep linking enabled");
    };

    // Evita un parpadeo en español mientras se lee el idioma guardado.
    if (isLoading) {
        return <LoadingView message={t("Cargando...")} />;
    }

    return (
        <AuthProvider>
            <AppDataProvider>
                <PushNotificationProvider 
                    defaultDuration={config.pushDuration * 1000} // Convertir segundos a milisegundos
                    maxNotifications={config.pushNotificationLimit || 15} // Límite total
                    maxNotificationsByType={config.pushNotificationLimitByType || 5} // Límite por tipo
                >
                    <DataLoadErrorBanner />
                    <NavigationContainer
                        linking={linkingConfig}
                        onReady={onReady}
                        fallback={<></>}
                        documentTitle={{
                            formatter: (options, route) => {
                                const routeTitles = {
                                    'FaceAttendEDU-Login': 'Iniciar Sesión',
                                    'FaceAttendEDU-Register': 'Registrarse',
                                    'Dashboard': 'Dashboard',
                                    'Users': 'Usuarios',
                                    'Courses': 'Cursos',
                                    'Environments': 'Ambientes',
                                    'Reports': 'Reportes',
                                    'Schools': 'Escuelas',
                                    'SchoolInfo': 'Información de la sede',
                                    'History': 'Historial',
                                    'Justifications': 'Justificaciones',
                                    'Academic': 'Sección académica',
                                    'Contacts': 'Contactos',
                                    'Biometrics': 'Biometría',
                                    'Settings': 'Configuración',
                                };
                                const title = routeTitles[route?.name];
                                return title ? `${t(title)} | FaceAttend EDU` : 'FaceAttend EDU';
                            }
                        }}
                    >
                        <AppNavigator />
                    </NavigationContainer>
                </PushNotificationProvider>
            </AppDataProvider>
        </AuthProvider>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <ResponsiveProvider>
                    <LanguageProvider>
                        <AppContent />
                    </LanguageProvider>
                </ResponsiveProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
