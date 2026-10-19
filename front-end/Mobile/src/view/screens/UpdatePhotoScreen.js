import React, {useMemo} from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../components/common/ThemeContext';
import BackButton from '../components/common/BackButton';
import CustomAlert from '../components/common/CustomAlert';
import {createUpdatePhotoStyles} from './Styles/UpdatePhotoScreen/Style';
import {useUpdatePhotoViewModel} from '../../viewmodels/useUpdatePhotoViewModel';

const STATUS_KEYS = {
    Pending: 'updatePhoto.status.pending',
    In_Review: 'updatePhoto.status.inReview',
    Approved: 'updatePhoto.status.approved',
    Rejected: 'updatePhoto.status.rejected',
};

export default function UpdatePhoto() {
    const {t} = useTranslation();
    const {colors, theme} = useTheme();
    const styles = useMemo(() => createUpdatePhotoStyles(colors), [colors]);
    const {
        updateKey, loading, submitting,
        latestCase, status, canRequest, canUpdateFace,
        reason, setReason, reasonValid, minReasonLength,
        submitRequest, goToFaceUpdate, handleBack,
        alertConfig, hideAlert,
    } = useUpdatePhotoViewModel();

    const statusColor = {
        Pending: colors.warning,
        In_Review: colors.novedadInfo,
        Approved: colors.success,
        Rejected: colors.danger,
    }[status] || colors.textSecondary;

    const card = {
        backgroundColor: colors.card, borderRadius: 15, padding: 20, marginTop: 16,
        borderWidth: theme === 'dark' ? 1 : 0, borderColor: colors.cardBorder,
    };
    const button = (enabled) => ({
        backgroundColor: colors.primary, padding: 12, borderRadius: 10, marginTop: 16,
        alignItems: 'center', opacity: enabled ? 1 : 0.5,
    });

    return (
        <SafeAreaView style={[styles.safeAreaUpdatePhoto, {flex: 1, backgroundColor: colors.background}]} key={`${updateKey}`}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                  style={styles.keyboardAvoidingViewUpdatePhoto}>
                <ScrollView showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollViewContentUpdatePhoto}
                            keyboardShouldPersistTaps="handled">
                    <View style={[styles.mainContainerUpdatePhoto, {marginTop: Platform.OS === 'ios' ? 0 : 50}]}>
                        <BackButton onPress={handleBack}/>
                        <View style={styles.imageContainerUpdatePhoto}>
                            <Image
                                source={require('../../assets/images/perfil-del-usuario.png')}
                                style={[styles.profileImageUpdatePhoto, {width: 120, height: 120, tintColor: colors.text}]}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={{fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: colors.text, marginTop: 10}}>
                            {t('updatePhoto.title')}
                        </Text>
                        <Text style={{textAlign: 'center', color: colors.textSecondary, marginVertical: 15}}>
                            {t('updatePhoto.requestInstructions')}
                        </Text>

                        {loading ? (
                            <ActivityIndicator size="large" color={colors.primary}/>
                        ) : (
                            <>
                                {latestCase && (
                                    <View style={card} accessibilityLiveRegion="polite">
                                        <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.text}}>
                                            {t('updatePhoto.latestRequest')}
                                        </Text>
                                        <Text style={{color: statusColor, fontWeight: '600', marginTop: 8}}>
                                            {t(STATUS_KEYS[status] || 'updatePhoto.status.pending')}
                                        </Text>
                                        <Text style={{color: colors.textSecondary, marginTop: 6}}>{latestCase.reason}</Text>
                                        {!!latestCase.resolutionNotes && (
                                            <Text style={{color: colors.text, marginTop: 6}}>
                                                {t('updatePhoto.reviewNotes', {notes: latestCase.resolutionNotes})}
                                            </Text>
                                        )}
                                        {canUpdateFace && (
                                            <TouchableOpacity style={button(true)} onPress={goToFaceUpdate}
                                                              accessibilityRole="button">
                                                <Text style={{color: colors.modalButtonText, fontWeight: '600'}}>
                                                    {t('updatePhoto.updateFaceNow')}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                {canRequest && (
                                    <View style={card}>
                                        <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 8}}>
                                            {t('updatePhoto.newRequest')}
                                        </Text>
                                        <Text style={{color: colors.text, marginBottom: 5}}>{t('updatePhoto.reasonLabel')}</Text>
                                        <TextInput
                                            value={reason}
                                            onChangeText={setReason}
                                            placeholder={t('updatePhoto.reasonPlaceholder')}
                                            placeholderTextColor={colors.textSecondary}
                                            multiline
                                            maxLength={500}
                                            accessibilityLabel={t('updatePhoto.reasonLabel')}
                                            style={{
                                                minHeight: 90, textAlignVertical: 'top', color: colors.text,
                                                backgroundColor: colors.inputBackground, borderColor: colors.border,
                                                borderWidth: 1, borderRadius: 8, padding: 10,
                                            }}
                                        />
                                        {!reasonValid && reason.length > 0 && (
                                            <Text style={{color: colors.danger, marginTop: 4}}>
                                                {t('updatePhoto.reasonTooShort', {min: minReasonLength})}
                                            </Text>
                                        )}
                                        <TouchableOpacity
                                            style={button(reasonValid && !submitting)}
                                            onPress={submitRequest}
                                            disabled={!reasonValid || submitting}
                                            accessibilityRole="button"
                                        >
                                            {submitting
                                                ? <ActivityIndicator color={colors.modalButtonText}/>
                                                : <Text style={{color: colors.modalButtonText, fontWeight: '600'}}>{t('updatePhoto.sendRequest')}</Text>}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                onClose={hideAlert}
                type={alertConfig.type}
            />
        </SafeAreaView>
    );
}
