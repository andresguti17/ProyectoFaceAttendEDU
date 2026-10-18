import React from 'react';
import {
    Animated,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Keyboard,
    View,
} from 'react-native';
import PrimaryButton from '../../components/auth/PrimaryButton';
import { PasswordRequirement } from './PasswordRequirement';
import { calculatePasswordStrength } from '../../../utils/passwordValidator';
import { createAuthStyles } from './style/Style';

/**
 * Modal de nueva contraseña
 */
export function PasswordModal({
                                  visible,
                                  passwordUpdate,
                                  colors,
                                  t,
                                  newPasswordRef,
                                  confirmPasswordRef,
                                  onClose,
                              }) {
    const modalScale = React.useRef(new Animated.Value(0.92)).current;
    const modalOpacity = React.useRef(new Animated.Value(0)).current;
    const styleAuth = React.useMemo(() => createAuthStyles(colors), [colors]);

    React.useEffect(() => {
        if (visible) {
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
            ]).start();
        }
    }, [visible, modalScale, modalOpacity]);

    const strength = calculatePasswordStrength(
        passwordUpdate.requirements,
        passwordUpdate.newPassword.length
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styleAuth.modalWrapper}>
                            <ScrollView
                                contentContainerStyle={styleAuth.modalScrollContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <Animated.View style={[
                                    styleAuth.passwordModalCard,
                                    {
                                        backgroundColor: colors.card,
                                        borderColor: colors.border,
                                        transform: [{ scale: modalScale }],
                                        opacity: modalOpacity,
                                    },
                                ]}>
                                    {/* Encabezado */}
                                    <Text style={[styleAuth.passwordModalTitle, { color: colors.text }]}>
                                        {t('passwordUpdate.title')}
                                    </Text>
                                    <Text style={[styleAuth.passwordModalDescription, { color: colors.textSecondary }]}>
                                        {t('passwordUpdate.description')}
                                    </Text>

                                    <View style={[
                                        styleAuth.passwordModalDivider,
                                        { backgroundColor: colors.border }
                                    ]} />

                                    {/* Campo nueva contraseña */}
                                    <View style={styleAuth.passwordFieldWrapper}>
                                        <TextInput
                                            ref={newPasswordRef}
                                            style={[styleAuth.passwordModalInput, {
                                                borderColor: colors.border,
                                                color: colors.text,
                                                backgroundColor: colors.background,
                                                paddingRight: 48,
                                            }]}
                                            placeholder={t('passwordUpdate.newPassword')}
                                            placeholderTextColor={colors.textSecondary}
                                            secureTextEntry={!passwordUpdate.showNewPassword}
                                            value={passwordUpdate.newPassword}
                                            onChangeText={(v) => {
                                                passwordUpdate.setNewPassword(v);
                                                passwordUpdate.clearError();
                                            }}
                                            returnKeyType="next"
                                            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                            accessibilityLabel={t('passwordUpdate.newPassword')}
                                            accessibilityHint={t('passwordUpdate.a11yRequirementsHint')}
                                            editable={!passwordUpdate.isLoading}
                                        />
                                        <TouchableOpacity
                                            style={styleAuth.eyeButton}
                                            onPress={() => passwordUpdate.setShowNewPassword(!passwordUpdate.showNewPassword)}
                                            accessibilityLabel={t(passwordUpdate.showNewPassword ? 'login.hidePassword' : 'login.showPassword')}
                                            accessibilityRole="button"
                                        >
                                            <Image
                                                source={
                                                    passwordUpdate.showNewPassword
                                                        ? require('../../../assets/images/lupa.png')
                                                        : require('../../../assets/images/esconder.png')
                                                }
                                                style={{ width: 24, height: 24, resizeMode: 'contain' }}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Barra de fortaleza */}
                                    {passwordUpdate.newPassword.length > 0 && (
                                        <View style={styleAuth.strengthBarContainer}>
                                            <View style={styleAuth.strengthBarTrack}>
                                                <View style={[styleAuth.strengthBarFill, {
                                                    width: `${(strength.score / 5) * 100}%`,
                                                    backgroundColor: strength.tone ? colors[strength.tone] : 'transparent',
                                                }]} />
                                            </View>
                                            <Text style={[styleAuth.strengthLabel, { color: strength.tone ? colors[strength.tone] : colors.textSecondary }]}>
                                                {strength.labelKey ? t(strength.labelKey) : ''}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Requisitos */}
                                    <View style={styleAuth.passwordReqContainer}>
                                        <PasswordRequirement
                                            met={passwordUpdate.requirements.length}
                                            label={t('passwordUpdate.reqLength')}
                                            colors={colors}
                                        />
                                        <PasswordRequirement
                                            met={passwordUpdate.requirements.uppercase}
                                            label={t('passwordUpdate.reqUppercase')}
                                            colors={colors}
                                        />
                                        <PasswordRequirement
                                            met={passwordUpdate.requirements.lowercase}
                                            label={t('passwordUpdate.reqLowercase')}
                                            colors={colors}
                                        />
                                        <PasswordRequirement
                                            met={passwordUpdate.requirements.number}
                                            label={t('passwordUpdate.reqNumber')}
                                            colors={colors}
                                        />
                                        <PasswordRequirement
                                            met={passwordUpdate.requirements.special}
                                            label={t('passwordUpdate.reqSpecial')}
                                            colors={colors}
                                        />
                                        <PasswordRequirement
                                            met={passwordUpdate.requirements.notCommon}
                                            label={t('passwordUpdate.reqNotCommon')}
                                            colors={colors}
                                        />
                                        <PasswordRequirement
                                            met={passwordUpdate.requirements.noSequential}
                                            label={t('passwordUpdate.reqNoSequential')}
                                            colors={colors}
                                        />
                                        <PasswordRequirement
                                            met={passwordUpdate.requirements.noRepeated}
                                            label={t('passwordUpdate.reqNoRepeated')}
                                            colors={colors}
                                        />
                                    </View>

                                    {/* Campo confirmar contraseña */}
                                    <View style={styleAuth.passwordFieldWrapper}>
                                        <TextInput
                                            ref={confirmPasswordRef}
                                            style={[styleAuth.passwordModalInput, {
                                                borderColor: passwordUpdate.confirmPassword && !passwordUpdate.passwordsMatch
                                                    ? (colors.danger)
                                                    : (colors.border),
                                                color: colors.text,
                                                backgroundColor: colors.background,
                                                paddingRight: 48,
                                            }]}
                                            placeholder={t('passwordUpdate.confirmPassword')}
                                            placeholderTextColor={colors.textSecondary}
                                            secureTextEntry={!passwordUpdate.showConfirmPassword}
                                            value={passwordUpdate.confirmPassword}
                                            onChangeText={(v) => {
                                                passwordUpdate.setConfirmPassword(v);
                                                passwordUpdate.clearError();
                                            }}
                                            returnKeyType="done"
                                            onSubmitEditing={passwordUpdate.updatePassword}
                                            accessibilityLabel={t('passwordUpdate.confirmPassword')}
                                            editable={!passwordUpdate.isLoading}
                                        />
                                        <TouchableOpacity
                                            style={styleAuth.eyeButton}
                                            onPress={() => passwordUpdate.setShowConfirmPassword(!passwordUpdate.showConfirmPassword)}
                                            accessibilityLabel={t(passwordUpdate.showConfirmPassword ? 'passwordUpdate.a11yHideConfirmation' : 'passwordUpdate.a11yShowConfirmation')}
                                            accessibilityRole="button"
                                        >
                                            <Image
                                                source={
                                                    passwordUpdate.showConfirmPassword
                                                        ? require('../../../assets/images/lupa.png')
                                                        : require('../../../assets/images/esconder.png')
                                                }
                                                style={{ width: 24, height: 24, resizeMode: 'contain' }}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Indicador de coincidencia */}
                                    {passwordUpdate.confirmPassword.length > 0 && (
                                        <Text style={[styleAuth.passwordMatchIndicator, {
                                            color: passwordUpdate.passwordsMatch
                                                ? (colors.success)
                                                : (colors.danger),
                                        }]} accessibilityLiveRegion="polite">
                                            {passwordUpdate.passwordsMatch
                                                ? t('passwordUpdate.passwordsMatch')
                                                : t('passwordUpdate.passwordsNoMatch')}
                                        </Text>
                                    )}

                                    {/* Error general */}
                                    {passwordUpdate.error && (
                                        <View style={[styleAuth.passwordModalErrorRow, {
                                            backgroundColor: (colors.danger) + '12',
                                            borderColor: (colors.danger) + '35',
                                        }]}>
                                            <Text style={[styleAuth.passwordModalError, { color: colors.danger }]}>
                                                {passwordUpdate.error.message}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Botones */}
                                    <View style={styleAuth.passwordModalButtons}>
                                        <View style={{ width: '100%' }}>
                                            <PrimaryButton
                                                title={
                                                    passwordUpdate.isLoading
                                                        ? t('passwordUpdate.saving')
                                                        : t('passwordUpdate.saveButton')
                                                }
                                                onPress={passwordUpdate.updatePassword}
                                                disabled={!passwordUpdate.canSubmit}
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={onClose}
                                            style={styleAuth.passwordModalCancelButton}
                                            accessibilityLabel={t('passwordUpdate.a11yCancel')}
                                            accessibilityRole="button"
                                        >
                                            <Text style={[styleAuth.passwordModalCancelText, { color: colors.primary }]}>
                                                {t('common.cancel')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </Animated.View>
                            </ScrollView>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </Modal>
    );
}
