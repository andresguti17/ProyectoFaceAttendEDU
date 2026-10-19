import React, {useEffect, useMemo, useState} from 'react';
import {
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
import {useCustomAlert} from './useCustomAlert';
import CustomAlert from './CustomAlert';
import PrimaryButton from '../auth/PrimaryButton';
import {createCommonStyles} from './style/Style';
import {PersonService} from '../../../services/PersonService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileUpdateModal({ userInfo = {}, personId = null, onSaved = null }) {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const stylesCommon = useMemo(() => createCommonStyles(colors), [colors]);
    const { alertConfig, hideAlert, showSuccess, showError } = useCustomAlert();

    const [isProfileModalVisible, setProfileModalVisible] = useState(false);
    const [name, setName] = useState(userInfo?.name || '');
    const [email, setEmail] = useState(userInfo?.email || '');
    const [phone, setPhone] = useState(userInfo?.phone || '');
    const [profileError, setProfileError] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
        if (isProfileModalVisible) {
            setName(userInfo?.name || '');
            setEmail(userInfo?.email || '');
            setPhone(userInfo?.phone || '');
        }
    }, [isProfileModalVisible, userInfo]);

    const resetProfileForm = () => {
        setName(userInfo?.name || '');
        setEmail(userInfo?.email || '');
        setPhone(userInfo?.phone || '');
        setProfileError('');
        setProfileLoading(false);
    };

    const openProfileModal = () => {
        resetProfileForm();
        setProfileModalVisible(true);
    };

    const closeProfileModal = () => {
        setProfileModalVisible(false);
        resetProfileForm();
    };

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleProfileUpdate = async () => {
        setProfileError('');

        if (!name.trim() || !email.trim() || !phone.trim()) {
            setProfileError(t('profile.profileModal.errorRequired'));
            return;
        }

        if (!validateEmail(email)) {
            setProfileError(t('profile.profileModal.errorEmail'));
            return;
        }

        if (phone.length < 7) {
            setProfileError(t('profile.profileModal.errorPhone'));
            return;
        }

        try {
            setProfileLoading(true);
            if (!personId) {
                throw new Error('no-person');
            }
            const current = await PersonService.getById(personId);
            if (!current) {
                throw new Error('no-person');
            }
            const parts = name.trim().split(/\s+/);
            const updated = await PersonService.updateFields(personId, {
                documentNumber: current.documentNumber,
                name: parts[0] || current.name,
                lastName: parts.length > 1 ? parts.slice(1).join(' ') : (current.lastName || ''),
                email: email.trim(),
                documentType: current.documentType || 'CC',
                bloodType: current.bloodType || null,
                birthDate: current.birthDate || null,
                address: current.address || null,
                phone: phone.trim(),
                status: current.status !== undefined ? current.status : true,
            });
            if (!updated) {
                throw new Error('update-failed');
            }
            // Mantener el email de sesión sincronizado si cambió.
            try {
                await AsyncStorage.setItem('userEmail', email.trim());
                const raw = await AsyncStorage.getItem('userProfile');
                if (raw) {
                    const profile = JSON.parse(raw);
                    profile.email = email.trim();
                    profile.name = updated.fullName || name.trim();
                    await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
                }
            } catch {}
            setProfileLoading(false);
            if (onSaved) {
                try { await onSaved(); } catch {}
            }
            showSuccess(
                t('profile.profileModal.successTitle'),
                t('profile.profileModal.successMessage')
            );
            closeProfileModal();
        } catch (error) {
            setProfileLoading(false);
            showError(t('profile.profileModal.errorGeneric'));
        }
    };

    return (
        <>
            {/* ── Trigger button ── */}
            <TouchableOpacity
                style={[stylesCommon.passwordSettingsButton, { backgroundColor: colors.card }]}
                onPress={openProfileModal}
                activeOpacity={0.75}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[stylesCommon.passwordSettingsTitle, { color: colors.text }]}>
                        {t('profile.profileModal.editTitle')}
                    </Text>
                </View>
                <Text style={{ fontSize: 20, color: colors.textSecondary, marginLeft: 4 }}>›</Text>
            </TouchableOpacity>

            {/* ── Modal ── */}
            <Modal
                visible={isProfileModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeProfileModal}
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
                                        {t('profile.profileModal.editTitle')}
                                    </Text>
                                    <Text style={[stylesCommon.passwordModalDescription, { color: colors.textSecondary }]}>
                                        {t('profile.profileModal.help')}
                                    </Text>

                                    <View style={[
                                        stylesCommon.passwordModalDivider,
                                        { backgroundColor: colors.border },
                                    ]} />

                                    {/* Inputs */}
                                    <Text style={{marginBottom: 10, color: colors.text}}>{t('profile.profileModal.enterEmail')}</Text>
                                    <TextInput
                                        style={[stylesCommon.passwordModalInput, {
                                            borderColor: colors.border,
                                            color: colors.text,
                                            backgroundColor: colors.background,
                                        }]}
                                        placeholder={t('profile.profileModal.emailPlaceholder')}
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="email-address"
                                        onChangeText={setEmail}
                                    />
                                    <Text style={{marginBottom: 10, color: colors.text, marginTop: 20}}>{t('profile.profileModal.enterPhone')}</Text>
                                    <TextInput
                                        style={[stylesCommon.passwordModalInput, {
                                            borderColor: colors.border,
                                            color: colors.text,
                                            backgroundColor: colors.background,
                                        }]}
                                        placeholder={t('profile.profileModal.phonePlaceholder')}
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="phone-pad"
                                        onChangeText={setPhone}
                                    />

                                    {/* Error */}
                                    {profileError ? (
                                        <View style={[
                                            stylesCommon.passwordModalErrorRow,
                                            {
                                                backgroundColor: (colors.danger) + '12',
                                                borderColor: (colors.danger) + '35',
                                            },
                                        ]}>
                                            <Text style={[stylesCommon.passwordModalError, { color: colors.danger }]}>
                                                {profileError}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {/* Botones */}
                                    <View style={stylesCommon.passwordModalButtons}>
                                        <View style={{ width: '100%' }}>
                                            <PrimaryButton
                                                title={
                                                    profileLoading
                                                        ? t('profile.profileModal.saving')
                                                        : t('profile.profileModal.saveButton')
                                                }
                                                onPress={handleProfileUpdate}
                                                disabled={profileLoading}
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={closeProfileModal}
                                            style={stylesCommon.passwordModalCancelButton}
                                        >
                                            <Text style={[stylesCommon.passwordModalCancelText, { color: colors.primary }]}>
                                                {t('profile.profileModal.cancel')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </ScrollView>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                onClose={hideAlert}
                type={alertConfig.type}
            />
        </>
    );
}
