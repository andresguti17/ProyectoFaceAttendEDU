import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    LayoutAnimation,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    UIManager,
    Vibration,
    View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../../components/common/ThemeContext';
import BackButton from '../../components/common/BackButton';
import {createLoginStyles} from '../Styles/Verifycodescreen/Style';

// Componentes
import {CodeInput} from '../../components/auth/CodeInput';
import {PasswordModal} from '../../components/auth/PasswordModal';
import {SuccessScreen} from '../../components/auth/SuccessScreen';

// Hooks
import {useCodeVerification} from '../../../hooks/useCodeVerification';
import {usePasswordUpdate} from '../../../hooks/usePasswordUpdate';
import {useCountdown} from '../../../hooks/useCountdown';

// Servicios y utilidades
import {VerificationService} from '../../../services/verificationService';

// Constantes
import {FOCUS_DELAY_MS, RESEND_COOLDOWN_MS, VerificationErrorType} from '../../../services/constants/auths';

// Inicialización única
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Pantalla de verificación de código
 */
export default function VerifyCodeScreen({ route, navigation }) {
    const { email } = route?.params ?? {};
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(() => createLoginStyles(colors), [colors]);

    // Refs
    const codeRefs = useRef([0, 1, 2, 3, 4, 5].map(() => React.createRef()));
    const newPasswordRef = useRef(null);
    const confirmPasswordRef = useRef(null);

    // Estados del modal
    const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
    const [successVisible, setSuccessVisible] = useState(false);

    // Animaciones del modal
    const modalScale = useRef(new Animated.Value(0.92)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;

    // Countdown de reenvío
    const resendCooldown = useCountdown(Math.ceil(RESEND_COOLDOWN_MS / 1000));

    // Hook de verificación de código
    const codeVerification = useCodeVerification({
        email,
        onSuccess: () => openPasswordModal(),
    });

    // Hook de actualización de contraseña
    const passwordUpdate = usePasswordUpdate({
        email,
        onSuccess: () => {
            closePasswordModal();
            setSuccessVisible(true);
        },
    });

    // Auto-focus en el primer input
    useEffect(() => {
        const timer = setTimeout(() => {
            codeRefs.current[0]?.current?.focus();
        }, FOCUS_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    // Vibración háptica en error
    useEffect(() => {
        if (codeVerification.error) {
            if (Platform.OS === 'ios') {
                Vibration.vibrate(200);
            } else {
                Vibration.vibrate([0, 100, 50, 100]);
            }
        }
    }, [codeVerification.error]);

    /**
     * Abre el modal de nueva contraseña con animación
     */
    const openPasswordModal = useCallback(() => {
        passwordUpdate.resetForm();
        setPasswordModalVisible(true);

        Animated.parallel([
            Animated.spring(modalScale, {
                toValue: 1,
                useNativeDriver: true,
                tension: 120,
                friction: 8
            }),
            Animated.timing(modalOpacity, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true
            }),
        ]).start(() => {
            setTimeout(() => newPasswordRef.current?.focus(), 200);
        });
    }, [modalScale, modalOpacity, passwordUpdate]);

    /**
     * Cierra el modal con confirmación si hay cambios
     */
    const closePasswordModal = useCallback(() => {
        const hasUnsavedChanges = passwordUpdate.newPassword.trim() ||
            passwordUpdate.confirmPassword.trim();

        if (hasUnsavedChanges) {
            Alert.alert(
                t('common.discardTitle'),
                t('passwordUpdate.discardMessage'),
                [
                    {
                        text: t('common.cancel'),
                        style: 'cancel',
                    },
                    {
                        text: t('common.discard'),
                        style: 'destructive',
                        onPress: () => {
                            Animated.parallel([
                                Animated.spring(modalScale, { toValue: 0.92, useNativeDriver: true }),
                                Animated.timing(modalOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
                            ]).start(() => setPasswordModalVisible(false));
                        },
                    },
                ]
            );
        } else {
            Animated.parallel([
                Animated.spring(modalScale, { toValue: 0.92, useNativeDriver: true }),
                Animated.timing(modalOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
            ]).start(() => setPasswordModalVisible(false));
        }
    }, [passwordUpdate.newPassword, passwordUpdate.confirmPassword, modalScale, modalOpacity, t]);

    /**
     * Reenvía el código de verificación
     */
    const handleResendCode = useCallback(async () => {
        if (resendCooldown.isActive) return;

        try {
            // Se espera la respuesta: sin await un fallo de red nunca llegaba al catch.
            await VerificationService.sendRecoveryCode(email);
            resendCooldown.start(Math.ceil(RESEND_COOLDOWN_MS / 1000));
            codeVerification.resetAttempts();

            Alert.alert(t('verifyCode.resentTitle'), t('verifyCode.resentMessage'), [{ text: t('common.ok') }]);
            setTimeout(() => codeRefs.current[0]?.current?.focus(), 300);
        } catch (err) {
            Alert.alert(t('common.error'), err?.message || t('verifyCode.resendError'));
            resendCooldown.reset();
        }
    }, [email, resendCooldown, codeVerification, t]);

    /**
     * Maneja la verificación del código
     */
    const handleVerifyCode = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        codeVerification.verifyCode();
    }, [codeVerification]);

    // Pantalla de éxito
    if (successVisible) {
        return (
            <SuccessScreen
                colors={colors}
                t={t}
                onNavigateToLogin={() => navigation.navigate('HomesScreen')}
            />
        );
    }

    // Mensaje de error traducido
    const getErrorMessage = () => {
        if (!codeVerification.error) return null;

        switch (codeVerification.error.type) {
            case VerificationErrorType.INVALID_CODE:
                return t('verifyCode.errorInvalid', {attempts: 5 - codeVerification.attempts});
            case VerificationErrorType.EXPIRED_CODE:
                return t('verifyCode.errorExpired');
            case VerificationErrorType.NO_CODE:
                return t('verifyCode.errorNoCode');
            default:
                return codeVerification.error.message;
        }
    };

    const errorMessage = getErrorMessage();

    return (
        <SafeAreaView style={[styles.safeAreaWhite, { backgroundColor: colors.backgroundWhite }]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                        <View style={[styles.container, { backgroundColor: colors.backgroundWhite }]}>

                            {/* Botón volver */}
                            <BackButton
                                onPress={codeVerification.isLoading ? undefined : () => navigation.goBack()}
                                style={codeVerification.isLoading && { opacity: 0.5 }}
                            />

                            <View style={styles.contentContainer}>
                                <View style={styles.recoveryIconContainer}>
                                    <Text style={styles.recoveryIcon}>📧</Text>
                                </View>

                                <Text style={[styles.textoSesion, { color: colors.text }]}>
                                    {t('verifyCode.title')}
                                </Text>

                                <Text style={[styles.textoCredenciales, { color: colors.textSecondary }]}>
                                    {t('verifyCode.description')}{' '}
                                    <Text style={{ fontWeight: '600', color: colors.text }}>{email}</Text>.
                                    {'\n'}
                                    {t('verifyCode.descriptionSub')}
                                </Text>

                                {/* Input de código */}
                                <View style={[styles.inputContainer, { marginTop: 16 }]}>
                                    <Text style={[styles.inputTitulo, {
                                        color: colors.text,
                                        textAlign: 'center',
                                        marginBottom: 12,
                                    }]}>
                                        {t('verifyCode.codeLabel')}
                                    </Text>

                                    <CodeInput
                                        value={codeVerification.code}
                                        onChange={codeVerification.setCode}
                                        error={codeVerification.error}
                                        colors={colors}
                                        codeRefs={codeRefs.current}
                                        onVerify={handleVerifyCode}
                                        disabled={codeVerification.isLoading || codeVerification.isLockedOut}
                                    />
                                </View>

                                {/* Error */}
                                {errorMessage && (
                                    <View style={[styles.recoveryErrorBox, {
                                        backgroundColor: (colors.danger) + '12',
                                        borderColor: (colors.danger) + '35',
                                    }]}>
                                        <Text style={[styles.recoveryErrorText, { color: colors.danger }]}>
                                            {errorMessage}
                                        </Text>
                                    </View>
                                )}

                                {/* Botón verificar */}
                                <TouchableOpacity
                                    style={[styles.recoveryPrimaryButton, {
                                        backgroundColor: codeVerification.canSubmit
                                            ? colors.primary
                                            : (colors.primary + '60'),
                                        opacity: codeVerification.canSubmit ? 1 : 0.7,
                                    }]}
                                    onPress={handleVerifyCode}
                                    disabled={!codeVerification.canSubmit}
                                    activeOpacity={0.8}
                                    accessibilityLabel={
                                        codeVerification.isLockedOut
                                            ? t('forgotPassword.waitSeconds', {seconds: codeVerification.lockoutRemaining})
                                            : codeVerification.isLoading
                                                ? t('verifyCode.verifying')
                                                : t('verifyCode.verifyA11y')
                                    }
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        disabled: !codeVerification.canSubmit,
                                        busy: codeVerification.isLoading
                                    }}
                                >
                                    {codeVerification.isLoading ? (
                                        <ActivityIndicator color={colors.onPrimary} size="small" />
                                    ) : codeVerification.isLockedOut ? (
                                        <Text style={styles.recoveryPrimaryButtonText}>
                                            {t('verifyCode.lockedWait', {seconds: codeVerification.lockoutRemaining})}
                                        </Text>
                                    ) : (
                                        <Text style={styles.recoveryPrimaryButtonText}>
                                            {t('verifyCode.verifyButton')}
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                {/* Reenviar código */}
                                <View style={{ alignItems: 'center', marginTop: 16 }}>
                                    <Text style={[styles.textoCredenciales, { color: colors.textSecondary }]}>
                                        {t('verifyCode.noCodeQuestion')}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={handleResendCode}
                                        disabled={resendCooldown.isActive}
                                        activeOpacity={0.7}
                                        accessibilityLabel={
                                            resendCooldown.isActive
                                                ? t('verifyCode.resendIn', {seconds: resendCooldown.remaining})
                                                : t('verifyCode.resendA11y')
                                        }
                                        accessibilityRole="button"
                                    >
                                        <Text style={{
                                            color: resendCooldown.isActive
                                                ? (colors.textSecondary)
                                                : colors.primary,
                                            fontWeight: '600',
                                            marginTop: 4,
                                        }}>
                                            {resendCooldown.isActive
                                                ? t('verifyCode.resendCountdown', {seconds: resendCooldown.remaining})
                                                : t('verifyCode.resendButton')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Modal de nueva contraseña */}
            <PasswordModal
                visible={isPasswordModalVisible}
                passwordUpdate={passwordUpdate}
                colors={colors}
                t={t}
                newPasswordRef={newPasswordRef}
                confirmPasswordRef={confirmPasswordRef}
                onClose={closePasswordModal}
            />
        </SafeAreaView>
    );
}
