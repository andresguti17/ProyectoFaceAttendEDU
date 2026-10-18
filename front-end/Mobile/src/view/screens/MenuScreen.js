import BackButton from '../components/common/BackButton';
import React, {useMemo} from "react";
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {useTranslation} from "react-i18next";
import {useTheme} from '../components/common/ThemeContext';
import DangerButton from "../components/auth/DangerButton";
import CustomLogo from "../components/common/logo";
import CustomAlert from '../components/common/CustomAlert';
import {useCustomAlert} from '../components/common/useCustomAlert';
import {createMenuStyles} from "./Styles/MenuScreen/Style";
import {useMenuViewModel} from '../../viewmodels/useMenuViewModel';
import {useUser} from '../../utils/UserContext';

export default function MenuScreen({ onLogout }) {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(() => createMenuStyles(colors), [colors]);

    // 👈 NUEVO: Obtenemos el usuario actual y las validaciones de rol
    const { currentUser, isTeacher, isStudent } = useUser();

    const {
        alertConfig,
        hideAlert,
        showConfirm,
        showError,
    } = useCustomAlert();

    const {
        isLoading,
        isAdmin,
        isSuperAdmin,
        updateKey,
        handleLogout: originalHandleLogout,
        navigateTo,
    } = useMenuViewModel({ onLogout });

    const handleLogout = () => {
        showConfirm(
            t('menu.logoutConfirmTitle'),
            t('menu.logoutConfirmMessage'),
            async () => {
                try {
                    await originalHandleLogout();
                } catch (error) {
                    console.error('Error en logout:', error);
                    showError(
                        t('common.error'),
                        t('menu.logoutError')
                    );
                }
            },
            () => {
                console.log('Logout cancelado por el usuario');
            }
        );
    };

    const handleBack = () => navigateTo("DashboardScreen");
    const handleUpdatePhoto = () => navigateTo("UpdatePhoto");
    const handleFacialFail = () => navigateTo("FacialFail");
    const handleMenuJustify = () => navigateTo("MenuJustify");
    const handleSettings = () => navigateTo("LanguageSettingsScreen");
    const handleSchool = () => navigateTo("SchoolConfigurationScreen");

    const MenuItem = ({ label, onPress }) => (
        <>
            <View style={{ height: 1, backgroundColor: colors.separator, marginVertical: 10 }} />
            <TouchableOpacity onPress={onPress}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={[styles.sectionTitleMenu, { color: colors.text }]}>
                        {label}
                    </Text>
                    <Image
                        source={require("../../assets/images/flecha-volver.png")}
                        style={[styles.arrowImage, { tintColor: colors.text }]}
                    />
                </View>
            </TouchableOpacity>
        </>
    );

    // 🔄 ACTUALIZADO: Lógica para obtener el nombre a mostrar de forma dinámica y segura
    const displayName = currentUser?.name || (isAdmin ? t('userRole.administrator') : isTeacher ? t('userRole.teacher') : t('userRole.student'));

    return (
        <>
            <SafeAreaView
                style={[styles.safeAreaWhite, { backgroundColor: colors.backgroundWhite }]}
                key={`${updateKey}`}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.menuScreen}
                >
                    <ScrollView
                        style={styles.ScrollView}
                        contentContainerStyle={styles.menuScrollContent}
                    >
                        <View style={[styles.container, {marginTop: Platform.OS === "ios" ? 0 : 15, marginHorizontal: 10}]}>
                            <BackButton onPress={handleBack} />

                            <View style={styles.containerSesion}>
                                <CustomLogo
                                    size="large"
                                    rounded={true}
                                    backgroundColor={colors.text}
                                    marginBottom={15}
                                />

                                {/* 🔄 ACTUALIZADO: Muestra el nombre real del usuario o un fallback por rol */}
                                <Text style={[styles.userText, { color: colors.text }]}>
                                    {displayName}
                                </Text>

                                {/* 🔄 ACTUALIZADO: Lógica de visibilidad.
                                    Pregunta académica: ¿Los profesores también deben actualizar sus parámetros faciales aquí?
                                    Si es solo para estudiantes, usa `isStudent`. Si es para todos los no-admin, usa `!isAdmin`.
                                    Aquí asumo que es solo para estudiantes por seguridad. */}
                                {isStudent && (
                                    <MenuItem
                                        label={t('menu.updateFacialParams')}
                                        onPress={handleUpdatePhoto}
                                    />
                                )}

                                <MenuItem
                                    label={
                                        isAdmin
                                            ? t('menu.justificationConfig')
                                            : isTeacher
                                                ? t('menu.teacherJustificationInfo')
                                                : t('menu.studentJustificationInfo')
                                    }
                                    onPress={handleMenuJustify}
                                />

                                <MenuItem label={t('menu.appSettings')} onPress={handleSettings} />

                                {(isStudent || isTeacher) && (
                                    <MenuItem
                                        label={t('menu.facialRecognitionFail')}
                                        onPress={handleFacialFail}
                                    />
                                )}

                                {isSuperAdmin && (
                                    <MenuItem
                                        label={t('schools.title')}
                                        onPress={() => navigateTo("Schools")}
                                    />
                                )}

                                {isAdmin && (
                                    <MenuItem
                                        label={t('menu.schoolConfiguration')}
                                        onPress={handleSchool}
                                    />
                                )}

                                <View style={styles.logoutContainer}>
                                    <DangerButton
                                        title={isLoading ? t('menu.loggingOut') : t('menu.logout')}
                                        onLogout={handleLogout}
                                        disabled={isLoading}
                                    />
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

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
