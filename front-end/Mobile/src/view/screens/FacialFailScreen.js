import React, {useMemo} from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../components/common/ThemeContext';
import BackButton from '../components/common/BackButton';
import {QuestionnaireModal} from '../components/common/QuestionnaireModal';
import {FacialUpdateModal} from '../components/common/FacialUpdateModal';
import CustomLogo from '../components/common/logo';
import CustomAlert from '../components/common/CustomAlert';
import {createFacialFailStyles} from './Styles/FacialFailScreen/Style';
import {useFacialFailViewModel} from '../../viewmodels/useFacialFailScreenViewModel';

export default function FacialFail() {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(() => createFacialFailStyles(colors), [colors]);

    const {
        updateKey,
        verified,
        verifying,
        showQuestionnaire,
        showFacialUpdate,
        handleBack,
        openQuestionnaire,
        closeQuestionnaire,
        openFacialUpdate,
        closeFacialUpdate,
        handleQuestionnaireSuccess,
        handleFacialUpdateSuccess,
        alertConfig,
        hideAlert,
    } = useFacialFailViewModel();

    return (
        <SafeAreaView
            style={[styles.safeAreaFacialFail, { backgroundColor: colors.background }]}
            key={`${updateKey}`}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardview}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={[styles.container, { marginHorizontal: 20 }]}>
                            <BackButton onPress={handleBack} />
                            <View style={styles.headerContainer}>
                                <Text style={[styles.mainTitle, { color: colors.text }]}>
                                    {t('facialFail.title')}
                                </Text>
                                <CustomLogo
                                    size="small"
                                    rounded={true}
                                    backgroundColor={colors.cameraBackground}
                                    marginBottom={-2}
                                />
                            </View>

                            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                {t('facialFail.subtitle')}
                            </Text>

                            {/* Tarjeta de Cuestionario */}
                            <TouchableOpacity
                                style={[
                                    styles.optionCard,
                                    {
                                        backgroundColor: colors.card,
                                        borderColor: colors.cardBorder,
                                        borderWidth: 1,
                                    },
                                ]}
                                onPress={openQuestionnaire}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.optionTitle, { color: colors.text }]}>
                                    {t('facialFail.questionnaire')}
                                </Text>
                                <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                                    {t('facialFail.questionnaireDescription')}
                                </Text>
                                {verifying ? (
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8}}>
                                        <ActivityIndicator size="small" color={colors.primary}/>
                                        <Text style={{color: colors.textSecondary}}>{t('facialFail.verifying')}</Text>
                                    </View>
                                ) : verified ? (
                                    <Text style={{color: colors.success, fontWeight: '600', marginTop: 8}}>
                                        ✓ {t('facialFail.verifiedBadge')}
                                    </Text>
                                ) : null}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.optionCard,
                                    {
                                        backgroundColor: colors.card,
                                        borderColor: colors.cardBorder,
                                        borderWidth: 1,
                                    },
                                    !verified && {opacity: 0.5},
                                ]}
                                onPress={openFacialUpdate}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.optionTitle, { color: colors.text }]}>
                                    {t('facialFail.updateParams')}
                                </Text>
                                <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                                    {t('facialFail.updateParamsDescription')}
                                </Text>
                                {!verified ? (
                                    <Text style={{color: colors.textSecondary, fontStyle: 'italic', marginTop: 8}}>
                                        {t('facialFail.lockedHint')}
                                    </Text>
                                ) : null}
                            </TouchableOpacity>

                            <Text style={[styles.recommendationsTitle, { color: colors.text }]}>
                                {t('facialFail.recommendations')}
                            </Text>

                            <View>
                                <Text style={[styles.recommendationSubtitle, { color: colors.text }]}>
                                    {t('facialFail.cameraQuality')}
                                </Text>
                                <Text style={[styles.recommendationText, { color: colors.textSecondary }]}>
                                    {t('facialFail.cameraQualityDescription')}
                                </Text>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </ScrollView>

            {/* Modales */}
            <QuestionnaireModal
                visible={showQuestionnaire}
                onClose={closeQuestionnaire}
                onSuccess={handleQuestionnaireSuccess}
            />

            <FacialUpdateModal
                visible={showFacialUpdate}
                onClose={closeFacialUpdate}
                onSuccess={handleFacialUpdateSuccess}
            />

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                type={alertConfig.type}
                onClose={hideAlert}
            />
        </SafeAreaView>
    );
}