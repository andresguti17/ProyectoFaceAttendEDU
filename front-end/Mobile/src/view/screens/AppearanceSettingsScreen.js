// ============================================================
//  AppearanceSettingsScreen
//
//  Pantalla de apariencia: modo claro/oscuro + color de acento.
//  Replica la funcionalidad de ModeBlock + AccentBlock de la web.
//  Todos los textos pasan por t() — soporta es/en/fr/pt.
// ============================================================
import React, {useState} from 'react';
import {
    KeyboardAvoidingView,
    PanResponder,
    Platform,
    SafeAreaView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../components/common/ThemeContext';
import ScrollViewWrapper from '../components/common/ScrollView';
import BackButton from '../components/common/BackButton';
import PrimaryButton from '../components/auth/PrimaryButton';
import {useAppearanceSettingsViewModel} from '../../viewmodels/useAppearanceSettingsViewModel';
import {createLanguageSettingsStyles} from './Styles/LanguageSettingsScreen/Style';
import {readableOn} from '../../theme/contrast';

// ─────────────────────────────────────────────────────────────
//  Sub-componente: barra de presets de color
// ─────────────────────────────────────────────────────────────
function ColorPresetBar({presets, currentHex, onSelect, colors}) {
    const {t} = useTranslation();
    return (
        <View style={{gap: 6}}>
            <View style={{
                flexDirection: 'row',
                height: 38,
                borderRadius: 14,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.border,
            }}>
                {presets.map((preset, idx) => {
                    const active = currentHex.toLowerCase() === preset.color.toLowerCase();
                    return (
                        <TouchableOpacity
                            key={preset.key}
                            onPress={() => onSelect(preset)}
                            activeOpacity={0.75}
                            style={{
                                flex: 1,
                                backgroundColor: preset.color,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRightWidth: idx === presets.length - 1 ? 0 : 1,
                                borderRightColor: readableOn(preset.color) + '40',
                            }}
                        >
                            {active && (
                                <View style={{
                                    backgroundColor: readableOn(preset.color) + '59',
                                    borderRadius: 20,
                                    width: 24, height: 24,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Text style={{color: readableOn(preset.color), fontSize: 14, fontWeight: 'bold'}}>✓</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Etiquetas */}
            <View style={{flexDirection: 'row'}}>
                {presets.map((preset) => {
                    const active = currentHex.toLowerCase() === preset.color.toLowerCase();
                    return (
                        <View key={preset.key} style={{flex: 1, alignItems: 'center'}}>
                            <Text style={{
                                fontSize: 10,
                                fontWeight: active ? '700' : '400',
                                color: active ? colors.primary : colors.textSecondary,
                            }}>
                                {t(preset.labelKey)}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────
//  Sub-componente: tarjeta de evaluación del color
// ─────────────────────────────────────────────────────────────
function ColorEvaluatorCard({verdict, colors}) {
    const {t} = useTranslation();
    if (!verdict) return null;
    return (
        <View style={{
            backgroundColor: colors.card,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
        }}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <View style={{
                    width: 10, height: 10,
                    borderRadius: 5,
                    backgroundColor: colors[verdict.scoreTone],
                }} />
                <Text style={{fontSize: 13, fontWeight: '700', color: colors[verdict.scoreTone], textTransform: 'capitalize'}}>
                    {t(verdict.score)}
                </Text>
                <Text style={{fontSize: 12, color: colors.textSecondary, marginLeft: 'auto'}}>
                    WCAG {verdict.wcagLevel === 'fail' ? t('appearance.wcagFail') : verdict.wcagLevel}  ·  {verdict.contrastRatio}:1
                </Text>
            </View>

            {[
                {text: t(verdict.readability)},
                {text: t(verdict.vibe)},
                {text: t(verdict.uiFit)},
                {text: t(verdict.tip)},
            ].map(({icon, text}, i) => (
                <View key={i} style={{flexDirection: 'row', gap: 8, alignItems: 'flex-start'}}>
                    <Text style={{fontSize: 13}}>{icon}</Text>
                    <Text style={{fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18}}>
                        {text}
                    </Text>
                </View>
            ))}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────
//  Pantalla principal
// ─────────────────────────────────────────────────────────────
export default function AppearanceSettingsScreen() {
    const {t}      = useTranslation();
    const {colors} = useTheme();
    const styles = React.useMemo(() => createLanguageSettingsStyles(colors), [colors]);

    const {
        selectedTheme, setSelectedTheme, themes,
        visionMode, setVisionMode,
        hue, sat, lum, currentHex,
        applyHSL, applyPreset, handleHexInput,
        verdict,
        VISION_MODES, VISION_PRESETS, VISION_DESCRIPTIONS,
        isLoading, alertData, clearAlert,
        handleSave, handleBack,
    } = useAppearanceSettingsViewModel();

    const [hexInputValue, setHexInputValue] = useState(currentHex);

    React.useEffect(() => {
        setHexInputValue(currentHex);
    }, [currentHex]);

    // Mapa de labels para modos de visión (usando las claves de traducción)
    const visionLabels = {
        normal:        t('settings.visionModeNormal'),
        deuteranopia:  t('settings.visionModeDeuteranopia'),
        protanopia:    t('settings.visionModeProtanopia'),
        tritanopia:    t('settings.visionModeTritanopia'),
        achromatopsia: t('settings.visionModeAchromatopsia'),
    };

    const sectionTitleStyle = [styles.languageSettingsTitle, {color: colors.text, marginTop: 28, fontSize: 20}];
    const sectionSubStyle   = [styles.languageSettingsSubtitle, {color: colors.textSecondary, marginBottom: 16, fontSize: 14}];
    const labelStyle        = {fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 4};

    // Traduce el mensaje de alerta (la clave viene del viewmodel)
    const alertMessage = alertData.message ? t(alertData.message) : null;

    return (
        <SafeAreaView style={[styles.languageSettingsSafeArea, {backgroundColor: colors.background}]}>
            <KeyboardAvoidingView
                style={{flex: 1}}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollViewWrapper>
                    <View style={{marginHorizontal: 20}}>
                        <BackButton onPress={handleBack} />

                        {/* ══════════════════════════════════════════ */}
                        {/* SECCIÓN 1 — MODO DE VISUALIZACIÓN          */}
                        {/* ══════════════════════════════════════════ */}
                        <Text style={[sectionTitleStyle, {marginTop: 30}]}>
                            {t('settings.displayMode')}
                        </Text>
                        <Text style={sectionSubStyle}>
                            {t('settings.displayModeDesc')}
                        </Text>

                        {themes.map((th) => (
                            <TouchableOpacity
                                key={th.code}
                                style={[
                                    styles.languageSettingsOption,
                                    {backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1},
                                    selectedTheme === th.code && {
                                        borderColor: colors.primary,
                                        backgroundColor: colors.primary + '20',
                                    },
                                ]}
                                onPress={() => setSelectedTheme(th.code)}
                            >
                                <Text style={[styles.languageSettingsOptionText, {color: colors.text}]}>
                                    {th.icon}  {t(th.label)}
                                </Text>
                                {selectedTheme === th.code && (
                                    <Text style={[styles.languageSettingsCheckmark, {color: colors.primary}]}>✓</Text>
                                )}
                            </TouchableOpacity>
                        ))}

                        {/* ══════════════════════════════════════════ */}
                        {/* SECCIÓN 2 — COLOR DE ACENTO                */}
                        {/* ══════════════════════════════════════════ */}
                        <Text style={sectionTitleStyle}>
                            {t('settings.accentColor')}
                        </Text>
                        <Text style={sectionSubStyle}>
                            {t('settings.accentColorDesc')}
                        </Text>

                        {/* ── Preview del color actual ────────────── */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            gap: 12, marginBottom: 16,
                        }}>
                            <View style={{
                                width: 52, height: 52, borderRadius: 26,
                                backgroundColor: currentHex,
                                borderWidth: 3, borderColor: colors.border,
                                shadowColor: currentHex,
                                shadowOffset: {width: 0, height: 3},
                                shadowOpacity: 0.4, shadowRadius: 8,
                                elevation: 6,
                            }} />
                            <View style={{flex: 1}}>
                                <Text style={{fontSize: 16, fontWeight: '700', color: colors.text}}>
                                    {currentHex.toUpperCase()}
                                </Text>
                                <Text style={{fontSize: 12, color: colors.textSecondary}}>
                                    HSL({hue}, {sat}%, {lum}%)
                                </Text>
                            </View>
                            <View style={{
                                backgroundColor: currentHex,
                                paddingHorizontal: 14, paddingVertical: 8,
                                borderRadius: 10,
                            }}>
                                <Text style={{color: readableOn(currentHex), fontSize: 12, fontWeight: '600'}}>
                                    {t('settings.colorPreview')}
                                </Text>
                            </View>
                        </View>

                        {/* ── Tabs de modo de visión ───────────────── */}
                        <Text style={[labelStyle, {marginBottom: 6}]}>
                            {t('settings.visionMode')}
                        </Text>
                        <View style={{
                            flexDirection: 'row', flexWrap: 'wrap', gap: 6,
                            backgroundColor: colors.card,
                            borderRadius: 14, padding: 8,
                            borderWidth: 1, borderColor: colors.border,
                            marginBottom: 8,
                        }}>
                            {VISION_MODES.map((vm) => {
                                const active = visionMode === vm;
                                return (
                                    <TouchableOpacity
                                        key={vm}
                                        onPress={() => setVisionMode(vm)}
                                        style={{
                                            paddingVertical: 7, paddingHorizontal: 12,
                                            borderRadius: 10,
                                            backgroundColor: active ? colors.primary : 'transparent',
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 11,
                                            fontWeight: active ? '700' : '400',
                                            color: active ? colors.onPrimary : colors.textSecondary,
                                        }}>
                                            {visionLabels[vm]}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Descripción del modo de visión */}
                        <Text style={{
                            fontSize: 12, color: colors.textSecondary,
                            lineHeight: 18, marginBottom: 16,
                        }}>
                            {t(VISION_DESCRIPTIONS[visionMode])}
                        </Text>

                        {/* ── Selector de presets ──────────────────── */}
                        <Text style={[labelStyle, {marginBottom: 8}]}>
                            {t('settings.colorPalette')}
                        </Text>
                        <ColorPresetBar
                            presets={VISION_PRESETS[visionMode]}
                            currentHex={currentHex}
                            onSelect={applyPreset}
                            colors={colors}
                        />

                        <View style={{height: 20}} />

                        {/* ── Evaluador de color ───────────────────── */}
                        <Text style={[labelStyle, {marginBottom: 8}]}>
                            {t('settings.colorEvaluation')}
                        </Text>
                        <ColorEvaluatorCard verdict={verdict} colors={colors} />

                        {/* ══════════════════════════════════════════ */}
                        {/* ALERTA / FEEDBACK                          */}
                        {/* ══════════════════════════════════════════ */}
                        {alertMessage && (
                            <TouchableOpacity
                                onPress={clearAlert}
                                activeOpacity={0.85}
                                style={{
                                    backgroundColor: alertData.type === 'success'
                                        ? colors.success + '20' : colors.danger + '20',
                                    borderRadius: 10, padding: 12, marginTop: 8,
                                    borderWidth: 1,
                                    borderColor: alertData.type === 'success' ? colors.success : colors.danger,
                                }}
                            >
                                <Text style={{
                                    fontSize: 13, textAlign: 'center',
                                    color: alertData.type === 'success' ? colors.success : colors.danger,
                                }}>
                                    {alertData.type === 'success' ? '✅  ' : '❌  '}{alertMessage}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* ══════════════════════════════════════════ */}
                        {/* BOTONES                                    */}
                        {/* ══════════════════════════════════════════ */}
                        <View style={{marginTop: 24}}>
                            <PrimaryButton
                                title={t('common.save')}
                                onPress={handleSave}
                                isLoading={isLoading}
                            />
                        </View>

                    </View>
                </ScrollViewWrapper>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
