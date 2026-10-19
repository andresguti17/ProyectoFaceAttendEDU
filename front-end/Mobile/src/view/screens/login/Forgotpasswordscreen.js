import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    LayoutAnimation,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    UIManager,
    View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../../components/common/ThemeContext';
import BackButton from '../../components/common/BackButton';
import {VerificationService, VerificationError} from '../../../services/verificationService';
import {VerificationErrorType} from '../../../services/constants/auths';
import {createLoginStyles} from '../Styles/Forgotpasswordscreen/Style';

const COOLDOWN_MS = 60000;
const REQUEST_TIMEOUT_MS = 15000;
const NAVIGATION_DELAY_MS = 1500;
const FOCUS_DELAY_MS = 400;

function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

function initializeLayoutAnimations() {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

initializeLayoutAnimations();

const RecoveryErrorType = {
    TIMEOUT: 'TIMEOUT',
    GENERIC: 'GENERIC',
};

class RecoveryError extends Error {
    constructor(type, message) {
        super(message);
        this.type = type;
        this.name = 'RecoveryError';
    }
}

const PasswordRecoveryService = {
    async sendRecoveryEmail(email) {
        const normalizedEmail = email.toLowerCase().trim();

        // El backend es el único dueño de la verificación: responde 202
        // anti-enumeración a cualquier correo y sólo emite código si la cuenta
        // existe. Aquí había una consulta previa a `GET person?email=` que ya
        // no es pública (401 sin sesión): el flujo moría antes de llegar a
        // forgot-password, ningún correo se enviaba y además filtraba si el
        // correo estaba registrado.
        try {
            await VerificationService.sendRecoveryCode(normalizedEmail);
        } catch (err) {
            if (err instanceof RecoveryError) throw err;
            throw new RecoveryError(
                err instanceof VerificationError && err.type === VerificationErrorType.TIMEOUT
                    ? RecoveryErrorType.TIMEOUT
                    : RecoveryErrorType.GENERIC,
                err?.message,
            );
        }
    },
};

function useCooldown(initialSeconds = 0) {
    const [remaining, setRemaining] = useState(initialSeconds);
    const timerRef = useRef(null);

    useEffect(() => {
        if (remaining <= 0) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        timerRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [remaining]);

    const startCooldown = useCallback((seconds) => {
        setRemaining(seconds);
    }, []);

    const resetCooldown = useCallback(() => {
        setRemaining(0);
    }, []);

    return {
        remaining,
        isActive: remaining > 0,
        startCooldown,
        resetCooldown,
    };
}

function useEmailValidation() {
    const [email, setEmail] = useState('');
    const [touched, setTouched] = useState(false);

    const isValid = useMemo(() => isValidEmail(email), [email]);
    const showError = touched && !isValid;

    const handleChange = useCallback((value) => {
        setEmail(value);
        if (touched && value.length === 0) {
            setTouched(false);
        }
    }, [touched]);

    const handleBlur = useCallback(() => {
        setTouched(true);
    }, []);

    const reset = useCallback(() => {
        setEmail('');
        setTouched(false);
    }, []);

    return {
        email,
        touched,
        isValid,
        showError,
        handleChange,
        handleBlur,
        reset,
    };
}

function usePasswordRecovery({ onSuccess }) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const lastAttemptRef = useRef(0);
    const cooldown = useCooldown();

    const canSubmit = useMemo(() => {
        return !isLoading && !cooldown.isActive && !isSuccess;
    }, [isLoading, cooldown.isActive, isSuccess]);


    const _validateRateLimit = useCallback(() => {
        const now = Date.now();
        const timeSinceLastAttempt = now - lastAttemptRef.current;

        if (timeSinceLastAttempt < COOLDOWN_MS) {
            const waitSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastAttempt) / 1000);
            throw new Error(t('forgotPassword.errorRateLimit', { seconds: waitSeconds }));
        }

        lastAttemptRef.current = now;
        cooldown.startCooldown(Math.ceil(COOLDOWN_MS / 1000));
    }, [cooldown, t]);

    const sendRecovery = useCallback(async (email) => {
        try {
            setError(null);
            setIsSuccess(false);

            // Validaciones
            if (!email.trim()) {
                throw new Error(t('forgotPassword.errorRequired'));
            }

            if (!isValidEmail(email)) {
                throw new Error(t('forgotPassword.errorInvalidEmail'));
            }

            _validateRateLimit();

            setIsLoading(true);
            Keyboard.dismiss();

            await PasswordRecoveryService.sendRecoveryEmail(email);

            setIsSuccess(true);

            if (onSuccess) {
                setTimeout(() => onSuccess(email), NAVIGATION_DELAY_MS);
            }
        } catch (err) {
            cooldown.resetCooldown();

            if (err instanceof RecoveryError) {
                setError({
                    type: err.type,
                    message: err.message,
                });
            } else {
                setError({
                    type: RecoveryErrorType.GENERIC,
                    message: err.message || t('forgotPassword.errorGeneric'),
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [onSuccess, cooldown, _validateRateLimit, t]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        isLoading,
        error,
        isSuccess,
        canSubmit,
        cooldown,
        sendRecovery,
        clearError,
    };
}

const FormInput = React.forwardRef(({
                                        label,
                                        error,
                                        isValid,
                                        touched,
                                        colors,
                                        disabled,
                                        ...props
                                    }, ref) => {
    const styles = useMemo(() => createLoginStyles(colors), [colors]);
    const borderColor = useMemo(() => {
        if (error && touched) return colors.danger;
        if (isValid && touched) return colors.success;
        return colors.border;
    }, [error, isValid, touched, colors]);

    return (
        <View style={styles.inputContainer}>
            <Text style={[styles.inputTitulo, { color: colors.text }]}>
                {label}
            </Text>
            <TextInput
                ref={ref}
                style={[
                    styles.inputEscrito,
                    {
                        backgroundColor: colors.inputBackground,
                        borderColor,
                        color: colors.text,
                    },
                ]}
                placeholderTextColor={colors.textMuted}
                editable={!disabled}
                {...props}
            />
        </View>
    );
});

FormInput.displayName = 'FormInput';

const AlertBox = ({ type, message, colors }) => {
    const styles = useMemo(() => createLoginStyles(colors), [colors]);
    const tone = type === 'error' ? colors.danger : colors.success;

    return (
        <View style={[
            styles.recoveryErrorBox,
            { backgroundColor: tone + '12', borderColor: tone + '35' }
        ]}>
            <Text style={[styles.recoveryErrorText, { color: tone }]}>
                {type === 'success' && '✓ '}
                {message}
            </Text>
        </View>
    );
};

const SubmitButton = ({
                          isLoading,
                          cooldown,
                          disabled,
                          onPress,
                          labels
                      }) => {
    const styles = useMemo(() => createLoginStyles(labels.colors), [labels.colors]);
    const backgroundColor = disabled
        ? (labels.colors.primary + '60')
        : labels.colors.primary;

    const accessibilityLabel = useMemo(() => {
        if (isLoading) return labels.sending;
        if (cooldown.isActive) return labels.waitSeconds(cooldown.remaining);
        return labels.sendA11y;
    }, [isLoading, cooldown, labels]);

    return (
        <TouchableOpacity
            style={[
                styles.recoveryPrimaryButton,
                { backgroundColor, opacity: disabled ? 0.7 : 1 }
            ]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled, busy: isLoading }}
        >
            {isLoading ? (
                <ActivityIndicator color={labels.colors.onPrimary} size="small" />
            ) : cooldown.isActive ? (
                <Text style={styles.recoveryPrimaryButtonText}>
                    {t('forgotPassword.retryIn', {seconds: cooldown.remaining})}
                </Text>
            ) : (
                <Text style={styles.recoveryPrimaryButtonText}>
                    {labels.sendButton}
                </Text>
            )}
        </TouchableOpacity>
    );
};

export default function ForgotPasswordScreen({ navigation }) {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(() => createLoginStyles(colors), [colors]);
    const emailInputRef = useRef(null);

    const emailValidation = useEmailValidation();
    const recovery = usePasswordRecovery({
        onSuccess: (email) => {
            navigation.navigate('VerifyCodeScreen', {
                email: email.toLowerCase().trim()
            });
        },
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            emailInputRef.current?.focus();
        }, FOCUS_DELAY_MS);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (recovery.error) {
            recovery.clearError();
        }
    }, [emailValidation.email]);

    const handleSend = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        recovery.sendRecovery(emailValidation.email);
    }, [emailValidation.email, recovery]);

    const handleBack = useCallback(() => {
        if (!recovery.isLoading) {
            navigation.goBack();
        }
    }, [navigation, recovery.isLoading]);

    const labels = useMemo(() => ({
        title: t('forgotPassword.title'),
        description: t('forgotPassword.description'),
        emailLabel: t('forgotPassword.emailLabel'),
        emailPlaceholder: t('forgotPassword.emailPlaceholder'),
        sendButton: t('forgotPassword.sendButton'),
        errorRequired: t('forgotPassword.errorRequired'),
        errorInvalidEmail: t('forgotPassword.errorInvalidEmail'),
        errorTimeout: t('forgotPassword.errorTimeout'),
        errorGeneric: t('forgotPassword.errorGeneric'),
        successMessage: t('forgotPassword.successMessage'),
        sending: t('forgotPassword.sending'),
        sendA11y: t('forgotPassword.sendA11y'),
        emailHint: t('forgotPassword.emailHint'),
        waitSeconds: (seconds) => t('forgotPassword.waitSeconds', {seconds}),
        colors,
    }), [t, colors]);

    const errorMessage = useMemo(() => {
        if (!recovery.error) return null;

        switch (recovery.error.type) {
            case RecoveryErrorType.TIMEOUT:
                return labels.errorTimeout;
            default:
                return recovery.error.message || labels.errorGeneric;
        }
    }, [recovery.error, labels]);

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

                            <BackButton
                                onPress={recovery.isLoading ? undefined : handleBack}
                                style={recovery.isLoading && { opacity: 0.5 }}
                            />

                            <View style={styles.contentContainer}>

                                <Text style={[styles.textoSesion, { color: colors.text }]}>
                                    {labels.title}
                                </Text>

                                <Text style={[styles.textoCredenciales, { color: colors.textSecondary }]}>
                                    {labels.description}
                                </Text>

                                <FormInput
                                    ref={emailInputRef}
                                    label={labels.emailLabel}
                                    error={recovery.error}
                                    isValid={emailValidation.isValid}
                                    touched={emailValidation.touched}
                                    colors={colors}
                                    disabled={recovery.isLoading || recovery.isSuccess}
                                    value={emailValidation.email}
                                    onChangeText={emailValidation.handleChange}
                                    onBlur={emailValidation.handleBlur}
                                    placeholder={labels.emailPlaceholder}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="send"
                                    onSubmitEditing={handleSend}
                                    accessibilityLabel={labels.emailLabel}
                                    accessibilityHint={labels.emailHint}
                                />

                                {errorMessage && (
                                    <AlertBox
                                        type="error"
                                        message={errorMessage}
                                        colors={colors}
                                    />
                                )}

                                {recovery.isSuccess && (
                                    <AlertBox
                                        type="success"
                                        message={labels.successMessage}
                                        colors={colors}
                                    />
                                )}

                                <SubmitButton
                                    isLoading={recovery.isLoading}
                                    cooldown={recovery.cooldown}
                                    disabled={!recovery.canSubmit || !emailValidation.isValid}
                                    onPress={handleSend}
                                    labels={labels}
                                />

                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
