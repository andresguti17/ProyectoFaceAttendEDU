import React from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenSafeArea from '../components/common/ScreenSafeArea';

import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../components/common/ThemeContext';
import {useAlertsConfig} from '../../utils/AlertsConfigContext';
import ScrollViewWrapper from '../components/common/ScrollView';
import ReturnButton from '../components/auth/ReturnButton';
import PrimaryButton from '../components/auth/PrimaryButton';
import {createLanguageSettingsStyles} from './Styles/LanguageSettingsScreen/Style';
import {useLanguageSettingsViewModel} from '../../viewmodels/useLanguageSettingsViewModel';

/** One switch per alert kind: label, description and the theme color it toggles with. */
const ALERT_TYPES = [
    {type: 'success', configKey: 'enableSuccess', label: 'settings.successAlerts', color: 'success'},
    {type: 'error', configKey: 'enableError', label: 'settings.errorAlerts', color: 'danger'},
    {type: 'warning', configKey: 'enableWarning', label: 'settings.warningAlerts', color: 'warning'},
    {type: 'confirm', configKey: 'enableConfirm', label: 'settings.confirmAlerts', color: 'primary'},
    {type: 'default', configKey: 'enableDefault', label: 'settings.defaultAlerts', color: 'primary'},
    {type: 'iot', configKey: 'enableIot', label: 'settings.iotAlerts', color: 'danger'},
];

function AlertSwitchRow({alert, enabled, onToggle, colors, styles, t}) {
    const tint = colors[alert.color];
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                marginBottom: 5,
            }}
        >
            <View style={{flex: 1, marginRight: 12}}>
                <Text style={[styles.languageSettingsOptionText, {color: colors.text}]}>{t(alert.label)}</Text>
                <Text
                    style={[
                        styles.languageSettingsSubtitle,
                        {color: colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'left'},
                    ]}
                >
                    {t(`${alert.label}Desc`)}
                </Text>
            </View>
            <Switch
                value={enabled}
                onValueChange={onToggle}
                trackColor={{false: colors.textSecondary + '40', true: tint + '70'}}
                thumbColor={enabled ? tint : colors.textSecondary}
            />
        </View>
    );
}

/** Section title and its explanatory line. */
function SectionHeader({title, subtitle, marginTop, colors, styles}) {
    return (
        <>
            <Text style={[styles.languageSettingsTitle, {color: colors.text, marginTop}]}>{title}</Text>
            <Text style={[styles.languageSettingsSubtitle, {color: colors.textSecondary}]}>{subtitle}</Text>
        </>
    );
}

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
        <ScreenSafeArea
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
                        {/* ═══ SECCIÓN: IDIOMA ═══ */}
                        <SectionHeader title={t('settings.language')} subtitle={t('settings.selectLanguage')} marginTop={30} colors={colors} styles={styles} />

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
                        <SectionHeader title={t('settings.appearance')} subtitle={t('settings.appearanceDesc')} marginTop={28} colors={colors} styles={styles} />

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
                        <SectionHeader title={t('settings.alertsConfiguration')} subtitle={t('settings.alertsConfigDesc')} marginTop={28} colors={colors} styles={styles} />

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

                            <ScrollView persistentScrollbar
                                showsVerticalScrollIndicator
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{
                                    paddingBottom: 10,
                                }}
                            >
                                {ALERT_TYPES.map((alert) => (
                                    <AlertSwitchRow
                                        key={alert.type}
                                        alert={alert}
                                        enabled={alertsConfig[alert.configKey]}
                                        onToggle={() => toggleAlertType(alert.type)}
                                        colors={colors}
                                        styles={styles}
                                        t={t}
                                    />
                                ))}
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
            <ReturnButton onPress={handleBack} />
        </ScreenSafeArea>
    );
}