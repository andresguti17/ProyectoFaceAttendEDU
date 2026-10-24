import React, {useEffect, useState, useRef} from 'react';
import {Linking} from 'react-native';
import * as Notifications from 'expo-notifications';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../utils/i18n';
import {getToken, removeToken} from '../storage/TokenStorage';
import {onSessionExpired, request} from '../api/apiClient';
import {useUser} from '../utils/UserContext';
import HomesScreen from '../view/screens/login/Login';
import MenuScreen from '../view/screens/MenuScreen';
import DashboardScreen from '../view/screens/DashboardScreen';
import NewsScreen from '../view/screens/NewsScreen';
import FacialFail from '../view/screens/FacialFailScreen';
import UpdatePhoto from '../view/screens/UpdatePhotoScreen';
import DisplayingAttendance from '../view/screens/DisplayingAttendance';
import MenuJustify from '../view/screens/MenuJustifyScreen';
import AddJustification from '../view/screens/AddJustifyScreen';
import LanguageSettingsScreen from '../view/screens/LanguageSettingsScreen';
import AppearanceSettingsScreen from '../view/screens/AppearanceSettingsScreen';
import AddValidJustificationScreen from '../view/screens/AddValidJustificationScreen';
import ValidJustificationsScreen from '../view/screens/ConsultJustifyScreen';
import JustificationTypesScreen from '../view/screens/ValidAllJustifications';
import ProfileScreen from '../view/screens/ProfileScreen';
import ManageUsersScreen from '../view/screens/ManageUsersScreen';
import UserDetailScreen from '../view/screens/UserDetailScreen';
import AttendanceReportScreen from '../view/screens/AttendanceReportScreen';
import SchoolConfigurationScreen from '../view/screens/SchoolConfigurationScreen';
import VerifyCodeScreen from "../view/screens/login/Verifycodescreen";
import ForgotPasswordScreen from "../view/screens/login/Forgotpasswordscreen";
import PendingJustificationScreen from "../view/screens/PendingJustificationScreen";
import ManageEnviromentScreen from "../view/screens/ManageEnviromentScreen";
import SchoolsScreen from "../view/screens/SchoolsScreen";
import RegisterFace from "../view/screens/RegisterFace";
import MyCoursesScreen from "../view/screens/MyCoursesScreen";
import BiometricCasesScreen from "../view/screens/BiometricCasesScreen";
import CustomAlert from '../view/components/common/CustomAlert';
import {useCustomAlert} from '../view/components/common/useCustomAlert';
import {PUSH_STORAGE_KEY, registerForPush, routeForNotification, unregisterPush} from '../services/PushService';

const Stack = createStackNavigator();

// Claves locales de sesión; el mismo conjunto borra checkAuth, handleLogout
// y la purga por sesión caducada (handleSessionExpired).
const SESSION_KEYS = ['userRole', 'userEmail', 'userProfile', 'appLanguage', 'alertsConfig', PUSH_STORAGE_KEY];
// Por dispositivo (sobrevive al logout): el aviso de permiso denegado sale una sola vez.
const PUSH_DENIED_NOTICE_KEY = 'pushDeniedNoticeShown';

async function clearLocalSession() {
    await removeToken();
    await AsyncStorage.multiRemove(SESSION_KEYS);
}

/**
 * ¿El sessionId sigue vivo en el backend? El token opaco caduca a las 8 h
 * (security_configuration.session_timeout_minutes) aunque localmente no
 * tenga expiresAt, y esa expiración es perezosa: el primer GET de sesión lo
 * marca "Closed". La llamada lleva el propio sessionId como bearer, así que
 * Kong (pre-function del edge) la responde con 401 en cuanto la sesión deja
 * de estar Active.
 *
 * Solo se descarta la sesión con una respuesta definitiva (401/404): si el
 * backend no responde se conserva, para no cerrar la sesión por un arranque
 * sin conexión.
 */
async function isSessionAlive(token) {
    try {
        const session = await request({method: 'GET', url: `api/v1/sessions/${token}`, requiresAuth: false});
        return session?.sessionStatus === 'Active';
    } catch (e) {
        return e?.status !== 401 && e?.status !== 404;
    }
}

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const navigationRef = useRef(null);
    const [navReady, setNavReady] = useState(false);
    const { loadUserData } = useUser();
    const {alertConfig, showAlert, hideAlert} = useCustomAlert();
    // Lo que sigue al cerrar el aviso actual, también con el botón atrás de Android.
    const onAlertClosedRef = useRef(null);
    const lastOpenedPushRef = useRef(null);

    const closeAlert = () => {
        hideAlert();
        const next = onAlertClosedRef.current;
        onAlertClosedRef.current = null;
        next?.();
    };

    // Explica el permiso antes del diálogo del sistema y continúa al cerrarse.
    const explainPushPermission = () => new Promise((resolve) => {
        onAlertClosedRef.current = resolve;
        showAlert({
            title: i18n.t('push.permission.title'),
            message: i18n.t('push.permission.body'),
            buttons: [{text: i18n.t('common.accept'), onPress: closeAlert}],
        });
    });

    const startPush = async () => {
        const {status} = await registerForPush({beforeRequest: explainPushPermission});
        if (status !== 'denied' || (await AsyncStorage.getItem(PUSH_DENIED_NOTICE_KEY))) return;
        await AsyncStorage.setItem(PUSH_DENIED_NOTICE_KEY, '1');
        showAlert({
            title: i18n.t('push.denied.title'),
            message: i18n.t('push.denied.body'),
            type: 'warning',
            buttons: [
                {text: i18n.t('common.close'), style: 'cancel', onPress: closeAlert},
                {
                    text: i18n.t('push.denied.open_settings'),
                    onPress: () => {
                        closeAlert();
                        Linking.openSettings().catch(() => {});
                    },
                },
            ],
        });
    };

    // Toque en una push: con la app viva (listener) o al abrirla desde la push,
    // también si se tocó con la sesión cerrada (se atiende tras el login).
    useEffect(() => {
        if (!isAuthenticated || !navReady) return undefined;
        const open = async (response) => {
            const id = response?.notification?.request?.identifier;
            if (!response || id === lastOpenedPushRef.current) return;
            lastOpenedPushRef.current = id;
            Notifications.clearLastNotificationResponseAsync().catch(() => {});
            const target = await routeForNotification(response, userRole);
            navigationRef.current?.navigate(target.name, target.params);
        };
        Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
        const subscription = Notifications.addNotificationResponseReceivedListener((response) => { void open(response); });
        return () => subscription.remove();
    }, [isAuthenticated, navReady, userRole]);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const role = await AsyncStorage.getItem('userRole');
            const token = await getToken();

            // Solo hay sesión si el token local sigue vigente Y el backend lo
            // reconoce: sin la segunda condición la app arrancaba "logueada"
            // con un sessionId ya cerrado y todas las llamadas devolvían 401.
            if (role && token && (await isSessionAlive(token))) {
                setIsAuthenticated(true);
                setUserRole(role);
            } else {
                await clearLocalSession();
                setIsAuthenticated(false);
                setUserRole(null);
            }
        } catch (e) {
            console.error('Error checking auth:', e);
            setIsAuthenticated(false);
            setUserRole(null);
        }
    };

    // El backend rechazó un sessionId que la app seguía usando: caducó
    // (session_timeout_minutes) y quedó Closed. Se purga la sesión local y se
    // vuelve al login en lugar de seguir disparando 401 en cada llamada; no se
    // intenta cerrar la sesión remota porque ya está muerta (logout daría 401).
    useEffect(() => {
        const handleSessionExpired = async () => {
            console.warn('Sesión caducada en el backend: volviendo al login');
            try {
                await clearLocalSession();
            } catch (e) {
                console.error('Error purgando sesión caducada:', e);
            }
            setIsAuthenticated(false);
            setUserRole(null);
            await loadUserData();
        };
        return onSessionExpired(() => { void handleSessionExpired(); });
    }, [loadUserData]);

    const handleLogin = async (role, token) => {
        try {
            await AsyncStorage.setItem('userRole', role);
            setIsAuthenticated(true);
            setUserRole(role);
            await loadUserData();
            void startPush();
        } catch (e) {
            console.error('Error guardando sesión:', e);
        }
    };

    const handleLogout = async () => {
        try {
            try {
                const { getToken } = require('../storage/TokenStorage');
                const { AuthService } = require('../services/AuthService');
                const sessionId = await getToken();
                // Antes del logout: el DELETE del token necesita la sesión viva.
                await unregisterPush();
                await AuthService.logout(sessionId);
            } catch {}
            await clearLocalSession();

            await i18n.changeLanguage('es');

            setIsAuthenticated(false);
            setUserRole(null);
            await loadUserData();

        } catch (e) {
            console.error('Error en logout:', e);
            setIsAuthenticated(false);
            setUserRole(null);
        }
    };

    if (isAuthenticated === null) {
        return null;
    }

    // Guard por rol: una pantalla que el rol no puede usar ni se registra, así
    // que navegar a ella (deep link, menú desactualizado) no la abre. Sin rol
    // verificado (null) solo quedan las pantallas comunes.
    const isAdmin = userRole === 'Administrador';
    const isStaff = isAdmin || userRole === 'Instructor';
    const isApprentice = userRole === 'Aprendiz';

    return (
        <>
        <NavigationContainer ref={navigationRef} onReady={() => setNavReady(true)}>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
            >
                {!isAuthenticated ? (
                    <>
                        <Stack.Screen name="HomesScreen">
                            {(props) => (
                                <HomesScreen
                                    {...props}
                                    onLogin={handleLogin}
                                />
                            )}
                        </Stack.Screen>
                        <Stack.Screen name="ForgotPasswordScreen" component={ForgotPasswordScreen}/>
                        <Stack.Screen name="VerifyCodeScreen" component={VerifyCodeScreen}/>
                    </>
                ) : (
                    <>
                        <Stack.Screen name="DashboardScreen">
                            {props => (
                                <DashboardScreen
                                    {...props}
                                    onLogout={handleLogout}
                                    userRole={userRole}
                                />
                            )}
                        </Stack.Screen>

                        <Stack.Screen name="Menu">
                            {props => (
                                <MenuScreen
                                    {...props}
                                    onLogout={handleLogout}
                                />
                            )}
                        </Stack.Screen>
                        <Stack.Screen name="Novedades" component={NewsScreen}/>
                        <Stack.Screen name="FacialFail" component={FacialFail}/>
                        <Stack.Screen name="UpdatePhoto" component={UpdatePhoto}/>
                        <Stack.Screen name="LanguageSettingsScreen" component={LanguageSettingsScreen}/>
                        <Stack.Screen name="AppearanceSettingsScreen" component={AppearanceSettingsScreen}/>
                        <Stack.Screen name="DisplayingAttendance" component={DisplayingAttendance}/>
                        <Stack.Screen name="MyCourses" component={MyCoursesScreen}/>
                        <Stack.Screen name="MenuJustify" component={MenuJustify}/>
                        {isApprentice && <Stack.Screen name="AddJustification" component={AddJustification}/>}
                        {isAdmin && <Stack.Screen name="AddValidJustification" component={AddValidJustificationScreen}/>}
                        {isAdmin && <Stack.Screen name="JustificationTypes" component={JustificationTypesScreen}/>}
                        <Stack.Screen name="ValidJustifications" component={ValidJustificationsScreen}/>
                        <Stack.Screen name="Profile">
                            {props => (
                                <ProfileScreen
                                    {...props}
                                    onLogout={handleLogout}
                                />
                            )}
                        </Stack.Screen>
                        {isAdmin && (
                            <>
                                <Stack.Screen name="ManageUsersScreen">
                                    {props => (
                                        <ManageUsersScreen
                                            {...props}
                                            userRole={userRole}
                                            onLogout={handleLogout}
                                        />
                                    )}
                                </Stack.Screen>
                                <Stack.Screen name="UserDetailScreen">
                                    {props => (
                                        <UserDetailScreen
                                            {...props}
                                            userRole={userRole}
                                        />
                                    )}
                                </Stack.Screen>
                                <Stack.Screen name="ManageEnviromentScreen">
                                    {props => (
                                        <ManageEnviromentScreen
                                            {...props}
                                            userRole={userRole}
                                        />
                                    )}
                                </Stack.Screen>
                                <Stack.Screen name="Schools" component={SchoolsScreen}/>
                                <Stack.Screen name="SchoolConfigurationScreen" component={SchoolConfigurationScreen}/>
                            </>
                        )}
                        {isStaff && (
                            <>
                                <Stack.Screen name="AttendanceReportScreen" component={AttendanceReportScreen}/>
                                <Stack.Screen name="BiometricCasesScreen" component={BiometricCasesScreen}/>
                            </>
                        )}
                        <Stack.Screen name="PendingJustificationScreen" component={PendingJustificationScreen}/>
                        <Stack.Screen name="RegisterFace" component={RegisterFace} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
        <CustomAlert
            visible={alertConfig.visible}
            title={alertConfig.title}
            message={alertConfig.message}
            buttons={alertConfig.buttons}
            type={alertConfig.type}
            onClose={closeAlert}
        />
        </>
    );
}