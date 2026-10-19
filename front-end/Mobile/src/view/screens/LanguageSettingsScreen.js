import React from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../components/common/ThemeContext';
import {useAlertsConfig} from '../../utils/AlertsConfigContext';
import ScrollViewWrapper from '../components/common/ScrollView';
import BackButton from '../components/common/BackButton';
import PrimaryButton from '../components/auth/PrimaryButton';
import {createLanguageSettingsStyles} from './Styles/LanguageSettingsScreen/Style';
import {useLanguageSettingsViewModel} from '../../viewmodels/useLanguageSettingsViewModel';

export default function LanguageSettingsScreen() {
    const {t} = useTranslation();
    const {colors} = useTheme();
    const styles = React.useMemo(() => createLanguageSettingsStyles(colors), [colors]);
    const {alertsConfig, toggleAlertType} = useAlertsConfig();
    const navigation = useNavigation();
    const [showAlertsModal, setShowAlertsModal] = React.useState(false);

    const {
        selectedLanguage,
        setSelectedLanguage,
        isLoading,
        updateKey,
        languages,
        handleSave,
        handleBack,
        alertData,
        clearAlert,
    } = useLanguageSettingsViewModel();

    return (
        <SafeAreaView
            style={[
                styles.languageSettingsSafeArea,
                {backgroundColor: colors.background},
            ]}
            key={updateKey}
        >
            <KeyboardAvoidingView
                style={{flex: 1}}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollViewWrapper>
                    <View style={[{marginHorizontal: 25}]}>
                        <BackButton onPress={handleBack} />
                        {/* ═══ SECCIÓN: IDIOMA ═══ */}
                        <Text
                            style={[
                                styles.languageSettingsTitle,
                                {color: colors.text, marginTop: 30},
                            ]}
                        >
                            {t('settings.language')}
                        </Text>

                        <Text
                            style={[
                                styles.languageSettingsSubtitle,
                                {color: colors.textSecondary},
                            ]}
                        >
                            {t('settings.selectLanguage')}
                        </Text>

                        {languages.map((lang) => (
                            <TouchableOpacity
                                key={lang.code}
                                style={[
                                    styles.languageSettingsOption,
                                    {
                                        backgroundColor: colors.card,
                                        borderColor: colors.border,
                                    },
                                    selectedLanguage === lang.code && {
                                        borderColor: colors.primary,
                                        backgroundColor: colors.primary + '20',
                                    },
                                ]}
                                onPress={() => setSelectedLanguage(lang.code)}
                            >
                                <Text
                                    style={[
                                        styles.languageSettingsOptionText,
                                        {color: colors.text},
                                    ]}
                                >
                                    {lang.flag} {lang.name}
                                </Text>

                                {selectedLanguage === lang.code && (
                                    <Text
                                        style={[
                                            styles.languageSettingsCheckmark,
                                            {color: colors.primary},
                                        ]}
                                    >
                                        ✓
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))}

                        {/* ═══ SECCIÓN: APARIENCIA ═══ */}
                        <Text
                            style={[
                                styles.languageSettingsTitle,
                                {marginTop: 28, color: colors.text},
                            ]}
                        >
                            {t('settings.appearance')}
                        </Text>

                        <Text
                            style={[
                                styles.languageSettingsSubtitle,
                                {color: colors.textSecondary},
                            ]}
                        >
                            {t('settings.appearanceDesc')}
                        </Text>

                        {/* Tarjeta de navegación → AppearanceSettingsScreen */}
                        <TouchableOpacity
                            style={[
                                styles.languageSettingsOption,
                                {
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                    borderWidth: 1,
                                },
                            ]}
                            onPress={() => navigation.navigate('AppearanceSettingsScreen')}
                            activeOpacity={0.75}
                        >
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1}}>
                                <Text style={{fontSize: 22}}>🎨</Text>
                                <View style={{flex: 1}}>
                                    <Text style={[styles.languageSettingsOptionText, {color: colors.text}]}>
                                        {t('settings.themeAndColor')}
                                    </Text>
                                    <Text style={{fontSize: 12, color: colors.textSecondary, marginTop: 2}}>
                                        {t('settings.themeAndColorDesc')}
                                    </Text>
                                </View>
                            </View>
                            <Text style={{fontSize: 20, color: colors.primary}}>›</Text>
                        </TouchableOpacity>

                        {/* ═══ SECCIÓN: CONFIGURACIÓN DE ALERTAS ═══ */}
                        <Text
                            style={[
                                styles.languageSettingsTitle,
                                {marginTop: 28, color: colors.text},
                            ]}
                        >
                            {t('settings.alertsConfiguration')}
                        </Text>

                        <Text
                            style={[
                                styles.languageSettingsSubtitle,
                                {color: colors.textSecondary},
                            ]}
                        >
                            {t('settings.alertsConfigDesc')}
                        </Text>

                        <TouchableOpacity
                            style={[
                                styles.languageSettingsOption,
                                {
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                },
                            ]}
                            onPress={() => setShowAlertsModal(true)}
                        >
                            <Text
                                style={[
                                    styles.languageSettingsOptionText,
                                    {color: colors.text},
                                ]}
                            >
                                {t('settings.configureAlerts')}
                            </Text>

                            <Text
                                style={{
                                    fontSize: 18,
                                    color: colors.primary,
                                }}
                            >
                                ›
                            </Text>
                        </TouchableOpacity>

                        {/* ═══ BOTONES ═══ */}
                        <PrimaryButton
                            title={t('common.save')}
                            onPress={handleSave}
                            isLoading={isLoading}
                        />
                    </View>
                </ScrollViewWrapper>

                {/* ═══════════════════════════════════════════ */}
                {/* ═══ MODAL DE CONFIGURACIÓN DE ALERTAS ═══ */}
                {/* ═══════════════════════════════════════════ */}
                <Modal
                    visible={showAlertsModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowAlertsModal(false)}
                >
                    <View
                        style={{
                            flex: 1,
                            backgroundColor: colors.modalOverlay,
                            justifyContent: 'center',
                            alignItems: 'center',
                            paddingHorizontal: 15,
                        }}
                    >
                        <View
                            style={[
                                {
                                    backgroundColor: colors.card,
                                    borderRadius: 15,
                                    padding: 20,
                                    width: '100%',
                                    maxHeight: '85%',
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.languageSettingsTitle,
                                    {
                                        color: colors.text,
                                        marginBottom: 5,
                                    },
                                ]}
                            >
                                {t('settings.configureAlerts')}
                            </Text>

                            <Text
                                style={[
                                    styles.languageSettingsSubtitle,
                                    {
                                        color: colors.textSecondary,
                                        marginBottom: 15,
                                    },
                                ]}
                            >
                                {t('settings.selectAlertTypes')}
                            </Text>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{
                                    paddingBottom: 10,
                                }}
                            >
                                {/* ─── Alerta de Éxito ─── */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor:
                                            colors.border,
                                        marginBottom: 5,
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            marginRight: 12,
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.languageSettingsOptionText,
                                                {color: colors.text},
                                            ]}
                                        >
                                            {t('settings.successAlerts')}
                                        </Text>

                                        <Text
                                            style={[
                                                styles.languageSettingsSubtitle,
                                                {
                                                    color: colors.textSecondary,
                                                    fontSize: 12,
                                                    marginTop: 4,
                                                    textAlign: 'left',
                                                },
                                            ]}
                                        >
                                            {t('settings.successAlertsDesc')}
                                        </Text>
                                    </View>

                                    <Switch
                                        value={alertsConfig.enableSuccess}
                                        onValueChange={() => toggleAlertType('success')}
                                        trackColor={{
                                            false: colors.textSecondary + '40',
                                            true: colors.success + '70',
                                        }}
                                        thumbColor={
                                            alertsConfig.enableSuccess
                                                ? colors.success
                                                : colors.textSecondary
                                        }
                                    />
                                </View>

                                {/* ─── Alerta de Error ─── */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor:
                                            colors.border,
                                        marginBottom: 5,
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            marginRight: 12,
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.languageSettingsOptionText,
                                                {color: colors.text},
                                            ]}
                                        >
                                            {t('settings.errorAlerts')}
                                        </Text>

                                        <Text
                                            style={[
                                                styles.languageSettingsSubtitle,
                                                {
                                                    color: colors.textSecondary,
                                                    fontSize: 12,
                                                    marginTop: 4,
                                                    textAlign: 'left',
                                                },
                                            ]}
                                        >
                                            {t('settings.errorAlertsDesc')}
                                        </Text>
                                    </View>

                                    <Switch
                                        value={alertsConfig.enableError}
                                        onValueChange={() => toggleAlertType('error')}
                                        trackColor={{
                                            false: colors.textSecondary + '40',
                                            true: colors.danger + '70',
                                        }}
                                        thumbColor={
                                            alertsConfig.enableError
                                                ? colors.danger
                                                : colors.textSecondary
                                        }
                                    />
                                </View>

                                {/* ─── Alerta de Advertencia ─── */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor:
                                            colors.border,
                                        marginBottom: 5,
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            marginRight: 12,
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.languageSettingsOptionText,
                                                {color: colors.text},
                                            ]}
                                        >
                                            {t('settings.warningAlerts')}
                                        </Text>

                                        <Text
                                            style={[
                                                styles.languageSettingsSubtitle,
                                                {
                                                    color: colors.textSecondary,
                                                    fontSize: 12,
                                                    marginTop: 4,
                                                    textAlign: 'left',
                                                },
                                            ]}
                                        >
                                            {t('settings.warningAlertsDesc')}
                                        </Text>
                                    </View>

                                    <Switch
                                        value={alertsConfig.enableWarning}
                                        onValueChange={() => toggleAlertType('warning')}
                                        trackColor={{
                                            false: colors.textSecondary + '40',
                                            true: colors.warning + '70',
                                        }}
                                        thumbColor={
                                            alertsConfig.enableWarning
                                                ? colors.warning
                                                : colors.textSecondary
                                        }
                                    />
                                </View>

                                {/* ─── Alerta de Confirmación ─── */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor:
                                            colors.border,
                                        marginBottom: 5,
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            marginRight: 12,
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.languageSettingsOptionText,
                                                {color: colors.text},
                                            ]}
                                        >
                                            {t('settings.confirmAlerts')}
                                        </Text>

                                        <Text
                                            style={[
                                                styles.languageSettingsSubtitle,
                                                {
                                                    color: colors.textSecondary,
                                                    fontSize: 12,
                                                    marginTop: 4,
                                                    textAlign: 'left',
                                                },
                                            ]}
                                        >
                                            {t('settings.confirmAlertsDesc')}
                                        </Text>
                                    </View>

                                    <Switch
                                        value={alertsConfig.enableConfirm}
                                        onValueChange={() => toggleAlertType('confirm')}
                                        trackColor={{
                                            false: colors.textSecondary + '40',
                                            true: colors.primary + '70',
                                        }}
                                        thumbColor={
                                            alertsConfig.enableConfirm
                                                ? colors.primary
                                                : colors.textSecondary
                                        }
                                    />
                                </View>

                                {/* ─── Alertas Generales ─── */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor:
                                            colors.border,
                                        marginBottom: 5,
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            marginRight: 12,
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.languageSettingsOptionText,
                                                {color: colors.text},
                                            ]}
                                        >
                                            {t('settings.defaultAlerts')}
                                        </Text>

                                        <Text
                                            style={[
                                                styles.languageSettingsSubtitle,
                                                {
                                                    color: colors.textSecondary,
                                                    fontSize: 12,
                                                    marginTop: 4,
                                                    textAlign: 'left',
                                                },
                                            ]}
                                        >
                                            {t('settings.defaultAlertsDesc')}
                                        </Text>
                                    </View>

                                    <Switch
                                        value={alertsConfig.enableDefault}
                                        onValueChange={() => toggleAlertType('default')}
                                        trackColor={{
                                            false: colors.textSecondary + '40',
                                            true: colors.primary + '70',
                                        }}
                                        thumbColor={
                                            alertsConfig.enableDefault
                                                ? colors.primary
                                                : colors.textSecondary
                                        }
                                    />
                                </View>

                                {/* ─── Alertas de Dispositivos IoT ─── */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        paddingVertical: 12,
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            marginRight: 12,
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.languageSettingsOptionText,
                                                {color: colors.text},
                                            ]}
                                        >
                                            {t('settings.iotAlerts')}
                                        </Text>

                                        <Text
                                            style={[
                                                styles.languageSettingsSubtitle,
                                                {
                                                    color: colors.textSecondary,
                                                    fontSize: 12,
                                                    marginTop: 4,
                                                    textAlign: 'left',
                                                },
                                            ]}
                                        >
                                            {t('settings.iotAlertsDesc')}
                                        </Text>
                                    </View>

                                    <Switch
                                        value={alertsConfig.enableIot}
                                        onValueChange={() => toggleAlertType('iot')}
                                        trackColor={{
                                            false: colors.textSecondary + '40',
                                            true: colors.danger + '70',
                                        }}
                                        thumbColor={
                                            alertsConfig.enableIot
                                                ? colors.danger
                                                : colors.textSecondary
                                        }
                                    />
                                </View>
                            </ScrollView>

                            {/* ─── Botón Cerrar Modal ─── */}
                            <TouchableOpacity
                                onPress={() => setShowAlertsModal(false)}
                                style={{
                                    marginTop: 15,
                                    backgroundColor: colors.primary,
                                    padding: 12,
                                    borderRadius: 8,
                                    alignItems: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        color: colors.modalButtonText,
                                        fontSize: 16,
                                        fontWeight: '600',
                                    }}
                                >
                                    {t('common.close')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}