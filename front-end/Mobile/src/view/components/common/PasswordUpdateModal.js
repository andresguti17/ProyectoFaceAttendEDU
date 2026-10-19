import React, {useMemo, useState} from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext';
import PrimaryButton from '../auth/PrimaryButton';
import {createCommonStyles} from './style/Style';
import {PasswordService} from '../../../services/passwordService';
import {areAllRequirementsMet, validatePasswordRequirements} from '../../../utils/passwordValidator';

export default function PasswordUpdateModal() {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const stylesCommon = useMemo(() => createCommonStyles(colors), [colors]);

    const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    const resetPasswordForm = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
        setPasswordLoading(false);
    };

    const openPasswordModal = () => {
        resetPasswordForm();
        setPasswordModalVisible(true);
    };

    const closePasswordModal = () => {
        setPasswordModalVisible(false);
        resetPasswordForm();
    };

    const handlePasswordUpdate = async () => {
        setPasswordError('');
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError(t('profile.passwordModal.errorRequired'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError(t('profile.passwordModal.errorMatch'));
            return;
        }
        if (!areAllRequirementsMet(validatePasswordRequirements(newPassword))) {
            setPasswordError(t('profile.passwordModal.errorPolicy'));
            return;
        }
        try {
            setPasswordLoading(true);
            await PasswordService.changePassword(currentPassword, newPassword);
            setPasswordLoading(false);
            Alert.alert(
                t('profile.passwordModal.successTitle'),
                t('profile.passwordModal.successMessage')
            );
            closePasswordModal();
        } catch (error) {
            setPasswordLoading(false);
            setPasswordError(error?.message || t('profile.passwordModal.errorGeneric'));
        }
    };

    return (
        <>
            {/* ── Trigger button ── */}
            <TouchableOpacity
                style={[stylesCommon.passwordSettingsButton, { backgroundColor: colors.card }]}
                onPress={openPasswordModal}
                activeOpacity={0.75}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[stylesCommon.passwordSettingsTitle, { color: colors.text }]}>
                        {t('profile.passwordModal.title')}
                    </Text>
                </View>
                <Text style={{ fontSize: 20, color: colors.textSecondary, marginLeft: 4 }}>›</Text>
            </TouchableOpacity>

            {/* ── Modal ── */}
            <Modal
                visible={isPasswordModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closePasswordModal}
            >
                <KeyboardAvoidingView
                    style={stylesCommon.modalWrapper}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={stylesCommon.modalWrapper}>
                            <ScrollView
                                contentContainerStyle={stylesCommon.modalScrollContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={[
                                    stylesCommon.passwordModalCard,
                                    {
                                        backgroundColor: colors.card,
                                        borderColor: colors.border,
                                    },
                                ]}>
                                    <Text style={[stylesCommon.passwordModalTitle, { color: colors.text }]}>
                                        {t('profile.passwordModal.title')}
                                    </Text>
                                    <Text style={[stylesCommon.passwordModalDescription, { color: colors.textSecondary }]}>
                                        {t('profile.passwordModal.help')}
                                    </Text>

                                    <View style={[
                                        stylesCommon.passwordModalDivider,
                                        { backgroundColor: colors.border },
                                    ]} />

                                    {/* Inputs — sin labels uppercase, solo placeholder */}
                                    <TextInput
                                        style={[stylesCommon.passwordModalInput, {
                                            borderColor: colors.border,
                                            color: colors.text,
                                            backgroundColor: colors.background,
                                        }]}
                                        placeholder={t('profile.passwordModal.currentPassword')}
                                        placeholderTextColor={colors.textSecondary}
                                        secureTextEntry
                                        onChangeText={setCurrentPassword}
                                    />
                                    <Text style={{marginBottom: 10, color: colors.text, marginTop: 20}}>{t('passwordUpdate.enterNew')}</Text>
                                    <TextInput
                                        style={[stylesCommon.passwordModalInput, {
                                            borderColor: colors.border,
                                            color: colors.text,
                                            backgroundColor: colors.background,
                                        }]}
                                        placeholder={t('profile.passwordModal.newPassword')}
                                        placeholderTextColor={colors.textSecondary}
                                        secureTextEntry
                                        onChangeText={setNewPassword}
                                    />
                                    <Text style={{marginBottom: 10, color: colors.text, marginTop: 20}}>{t('passwordUpdate.confirmNew')}</Text>
                                    <TextInput
                                        style={[stylesCommon.passwordModalInput, {
                                            borderColor: colors.border,
                                            color: colors.text,
                                            backgroundColor: colors.background,
                                        }]}
                                        placeholder={t('profile.passwordModal.confirmPassword')}
                                        placeholderTextColor={colors.textSecondary}
                                        secureTextEntry
                                        onChangeText={setConfirmPassword}
                                    />

                                    {/* Error */}
                                    {passwordError ? (
                                        <View style={[
                                            stylesCommon.passwordModalErrorRow,
                                            {
                                                backgroundColor: (colors.danger) + '12',
                                                borderColor: (colors.danger) + '35',
                                            },
                                        ]}>
                                            <Text style={[stylesCommon.passwordModalError, { color: colors.danger }]}>
                                                {passwordError}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {/* Botones */}
                                    <View style={stylesCommon.passwordModalButtons}>
                                        <View style={{ width: '100%' }}>
                                            <PrimaryButton
                                                title={
                                                    passwordLoading
                                                        ? t('profile.passwordModal.saving')
                                                        : t('profile.passwordModal.saveButton')
                                                }
                                                onPress={handlePasswordUpdate}
                                                disabled={passwordLoading}
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={closePasswordModal}
                                            style={stylesCommon.passwordModalCancelButton}
                                        >
                                            <Text style={[stylesCommon.passwordModalCancelText, { color: colors.primary }]}>
                                                {t('profile.passwordModal.cancel')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </ScrollView>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}