import React, {useEffect, useMemo} from 'react';
import {ActivityIndicator, SafeAreaView, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../components/common/ThemeContext';
import BackButton from '../components/common/BackButton';
import {createUserDetailStyles} from './Styles/UserDetailScreen/Style';
import {MIN_ATTENDANCE, useUserDetailViewModel} from '../../viewmodels/useUserDetailViewModel';


const initials = (name) => String(name || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

// Detalle de un usuario para el Administrador, equivalente móvil del
// StudentDetailModal web: perfil, datos, asistencia y estado biométrico.
export default function UserDetailScreen({navigation, userRole}) {
    const {t} = useTranslation();
    const {colors} = useTheme();
    const styles = useMemo(() => createUserDetailStyles(colors), [colors]);
    const vm = useUserDetailViewModel();

    // Solo el Administrador consulta el detalle completo de otro usuario.
    useEffect(() => {
        if (userRole && userRole !== 'Administrador') navigation.goBack();
    }, [userRole, navigation]);

    const card = [styles.userDetailCard, {backgroundColor: colors.card, borderColor: colors.cardBorder || colors.border}];
    const rate = vm.attendance?.rate;
    const attColor = rate === null || rate === undefined ? colors.textSecondary
        : rate >= MIN_ATTENDANCE ? colors.success : rate >= 70 ? colors.warning : colors.danger;

    const Row = ({label, value}) => (
        <View style={styles.userDetailRow}>
            <Text style={[styles.userDetailRowLabel, {color: colors.textSecondary}]}>{label}</Text>
            <Text style={[styles.userDetailRowValue, {color: colors.text}]}>{value || '—'}</Text>
        </View>
    );

    const Badge = ({text, color}) => (
        <View style={[styles.userDetailBadge, {backgroundColor: `${color}22`}]}>
            <Text style={[styles.userDetailBadgeText, {color}]}>{text}</Text>
        </View>
    );

    const bio = vm.biometrics;
    const bioText = !bio ? t('userDetail.biometricsUnavailable')
        : bio.hasFace && bio.hasFingerprint ? t('userDetail.biometricsRegistered')
            : bio.hasFace ? t('userDetail.missingFingerprint')
                : bio.hasFingerprint ? t('userDetail.missingFace')
                    : t('userDetail.noBiometrics');

    const BioItem = ({label, ok}) => (
        <View style={styles.userDetailBiometricItem}>
            <Text style={{color: colors.text}}>{label}</Text>
            <Text style={{color: ok ? colors.success : colors.textSecondary, fontWeight: '600'}}>
                {ok ? t('userDetail.registered') : t('userDetail.pending')}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.userDetailContainer, {backgroundColor: colors.background}]}>
            <View style={styles.userDetailHeader}>
                <BackButton onPress={vm.handleBack}/>
                <Text style={[styles.userDetailTitle, {color: colors.text}]}>{t('userDetail.title')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.userDetailContent}>
                {/* Perfil */}
                <View style={[card, styles.userDetailProfile]}>
                    <View style={[styles.userDetailAvatar, {backgroundColor: colors.primary}]}>
                        <Text style={styles.userDetailAvatarText}>{initials(vm.name)}</Text>
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={[styles.userDetailName, {color: colors.text}]}>{vm.name}</Text>
                        {vm.username ? (
                            <Text style={[styles.userDetailMeta, {color: colors.textSecondary}]}>{vm.username}</Text>
                        ) : null}
                        <View style={styles.userDetailBadges}>
                            <Badge
                                text={vm.active ? t('userDetail.active') : t('userDetail.inactive')}
                                color={vm.active ? colors.success : colors.textSecondary}
                            />
                            {vm.roleNames.map((role) => <Badge key={role} text={role} color={colors.primary}/>)}
                        </View>
                    </View>
                </View>

                {vm.loading ? (
                    <View style={styles.userDetailLoading}>
                        <ActivityIndicator color={colors.primary}/>
                        <Text style={{color: colors.textSecondary}}>{t('userDetail.loading')}</Text>
                    </View>
                ) : (
                    <>
                        {/* Información personal y académica */}
                        <View style={card}>
                            <Text style={[styles.userDetailSectionTitle, {color: colors.text}]}>
                                {t('userDetail.personalInfo')}
                            </Text>
                            <Row label={t('userDetail.email')} value={vm.email}/>
                            <Row label={t('userDetail.phone')} value={vm.phone}/>
                            <Row label={t('userDetail.document')} value={vm.documentNumber}/>
                            <Row label={t('userDetail.username')} value={vm.username}/>
                            <Row label={t('userDetail.program')} value={vm.program}/>
                            <Row label={t('userDetail.cohort')} value={vm.cohort}/>
                        </View>

                        {/* Asistencia */}
                        <View style={card}>
                            <View style={styles.userDetailAttendanceHeader}>
                                <Text style={[styles.userDetailSectionTitle, {color: colors.text, marginBottom: 0}]}>
                                    {t('userDetail.attendance')}
                                </Text>
                                <Text style={[styles.userDetailAttendanceValue, {color: attColor}]}>
                                    {rate === null || rate === undefined ? '—' : `${rate}%`}
                                </Text>
                            </View>
                            <View style={[styles.userDetailBarTrack, {backgroundColor: colors.border}]}>
                                <View style={[styles.userDetailBarFill, {width: `${rate || 0}%`, backgroundColor: attColor}]}/>
                            </View>
                            <Text style={[styles.userDetailHint, {color: colors.textSecondary}]}>
                                {rate === null || rate === undefined
                                    ? t('userDetail.noAttendance')
                                    : rate >= MIN_ATTENDANCE
                                        ? t('userDetail.attendanceOk', {min: MIN_ATTENDANCE})
                                        : t('userDetail.attendanceLow', {min: MIN_ATTENDANCE})}
                            </Text>
                            {vm.attendance?.total ? (
                                <Text style={[styles.userDetailHint, {color: colors.textSecondary}]}>
                                    {t('userDetail.attendanceCounts', vm.attendance)}
                                </Text>
                            ) : null}
                        </View>

                        {/* Biometría */}
                        <View style={card}>
                            <Text style={[styles.userDetailSectionTitle, {color: colors.text}]}>
                                {t('userDetail.biometrics')}
                            </Text>
                            <Text style={{color: colors.textSecondary, marginBottom: 6}}>{bioText}</Text>
                            {bio ? (
                                <>
                                    <BioItem label={t('userDetail.face')} ok={bio.hasFace}/>
                                    <BioItem label={t('userDetail.fingerprint')} ok={bio.hasFingerprint}/>
                                </>
                            ) : null}
                            {vm.canRegisterFace ? (
                                <TouchableOpacity
                                    style={[styles.userDetailButton, {backgroundColor: colors.primary}]}
                                    onPress={vm.openFaceRegistration}
                                >
                                    <Text style={styles.userDetailButtonText}>
                                        {bio?.hasFace ? t('userDetail.updateFace') : t('userDetail.registerFace')}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
