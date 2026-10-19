import React, {useMemo} from 'react';
import {Platform, SafeAreaView, ScrollView, Text, TouchableOpacity, View,} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../components/common/ThemeContext';
import BackButton from '../components/common/BackButton';
import PasswordUpdateModal from '../components/common/PasswordUpdateModal';
import ProfileUpdateModal from '../components/common/ProfileUpdateModal';
import {createProfileStyles} from './Styles/ProfileScreen/Style';
import {useProfileViewModel} from '../../viewmodels/useProfileViewModel';

/** Fila de información clave → valor */
const InfoField = ({ label, value, colors }) => {
    const styles = useMemo(() => createProfileStyles(colors), [colors]);
    return (
    <View style={[styles.infoFieldContainerProfile, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        shadowColor: colors.text,
    }]}>
        <Text style={[styles.infoFieldLabelProfile, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoFieldValueProfile, { color: colors.text }]}>{value ?? '—'}</Text>
    </View>
    );
};

/** Encabezado de sección con acento de color y badge opcional — ÚNICA definición */
const SectionTitle = ({ title, colors, badge, badgeLabel }) => {
    const styles = useMemo(() => createProfileStyles(colors), [colors]);
    return (
    <View style={styles.sectionTitleContainer}>
        <View style={[styles.sectionTitleAccentProfile, { backgroundColor: colors.primary }]} />
        <Text style={[styles.sectionTitleMenuProfile, { color: colors.text }]}>{title}</Text>
        {badge !== undefined && badge > 0 ? (
            <View style={[styles.sectionBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.sectionBadgeText, { color: colors.primary }]}>
                    {badge}{badgeLabel ? ` ${badgeLabel}` : ''}
                </Text>
            </View>
        ) : null}
    </View>
    );
};

const StatItem = ({ label, value, color, colors }) => {
    const styles = useMemo(() => createProfileStyles(colors), [colors]);
    return (
    <View style={styles.statItemProfile}>
        <Text style={[styles.statValueProfile, { color }]}>{value ?? 0}</Text>
        <Text style={[styles.statLabelProfile, { color }]}>{label}</Text>
    </View>
    );
};

/** Tarjeta de curso para estudiante */
const CourseCard = ({ course, colors }) => {
    const styles = useMemo(() => createProfileStyles(colors), [colors]);
    return (
    <View style={[styles.infoFieldContainerProfile, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        shadowColor: colors.text,
    }]}>
        <Text style={[styles.infoFieldLabelProfile, { color: colors.textSecondary }]}>
            {course.course_code ?? '—'}
        </Text>
        <Text style={[styles.infoFieldValueProfile, { color: colors.text }]}>
            {course.course_name ?? course.name ?? '—'}
        </Text>
    </View>
    );
};

/** Tarjeta de estadísticas de asistencia para estudiante */
const AttendanceStatsCard = ({ stats, colors, t }) => {
    const styles = useMemo(() => createProfileStyles(colors), [colors]);
    return (
    <View style={[styles.infoFieldContainerProfile, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        shadowColor: colors.text,
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
    }]}>
        <StatItem
            label={t('profile.present')}
            value={stats.present}
            color={colors.success}
            colors={colors}
        />
        <StatItem
            label={t('profile.absent')}
            value={stats.absent}
            color={colors.danger}
            colors={colors}
        />
        <StatItem
            label={t('profile.justified')}
            value={stats.justified}
            color={colors.warning}
            colors={colors}
        />
    </View>
    );
};

/** Tarjeta de justificación para estudiante */
const JustificationCard = ({ item, colors, t }) => {
    const styles = useMemo(() => createProfileStyles(colors), [colors]);
    const isPending = item?.approval === 'Pending';
    const isRejected = item?.approval === 'Rejected';
    const statusColor = isPending ? colors.warning : isRejected ? colors.danger : colors.success;

    return (
        <View style={[styles.infoFieldContainerProfile, {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.text,
        }]}>
            <Text style={[styles.infoFieldLabelProfile, { color: colors.textSecondary }]}>
                {item?.date ?? '—'}
            </Text>
            <Text style={[styles.infoFieldValueProfile, { color: colors.text }]}>
                {item?.reason ?? '—'}
            </Text>
            <Text style={[styles.infoFieldLabelProfile, { color: statusColor, marginTop: 4 }]}>
                {isPending
                    ? t('profile.pending', 'Pendiente')
                    : isRejected
                        ? t('profile.rejected', 'Rechazada')
                        : t('profile.approved', 'Aprobada')}
            </Text>
        </View>
    );
};

/** Tarjeta de horario para profesor */
const TeacherScheduleCard = ({ schedule, colors }) => {
    const styles = useMemo(() => createProfileStyles(colors), [colors]);
    return (
    <View style={[styles.infoFieldContainerProfile, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        shadowColor: colors.text,
    }]}>
        <Text style={[styles.infoFieldLabelProfile, { color: colors.textSecondary }]}>
            {schedule.day ?? '—'} · {schedule.start_time ?? '—'} – {schedule.end_time ?? '—'}
        </Text>
        <Text style={[styles.infoFieldValueProfile, { color: colors.text }]}>
            {schedule.course_name ?? '—'}
        </Text>
        <Text style={[styles.infoFieldLabelProfile, { color: colors.textSecondary, marginTop: 2 }]}>
            {schedule.classroom ?? '—'}
        </Text>
    </View>
    );
};

/** Tarjeta de asistencia por curso para profesor */
const TeacherCourseStatCard = ({ courseStat, colors, t }) => {
    const styles = useMemo(() => createProfileStyles(colors), [colors]);
    return (
    <View style={[styles.infoFieldContainerProfile, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        shadowColor: colors.text,
    }]}>
        <Text style={[styles.infoFieldValueProfile, { color: colors.text }]}>
            {courseStat.course_name ?? courseStat.course_code ?? '—'}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <StatItem
                label={t('profile.present')}
                value={courseStat.present}
                color={colors.success}
                colors={colors}
            />
            <StatItem
                label={t('profile.absent')}
                value={courseStat.absent}
                color={colors.danger}
                colors={colors}
            />
            <StatItem
                label={t('profile.total')}
                value={courseStat.total}
                color={colors.text}
                colors={colors}
            />
        </View>
    </View>
    );
};

/** Tarjeta de información del colegio para administrador */
const SchoolInfoCard = ({ schoolInfo, colors, t }) => (
    <View>
        <InfoField
            label={t('profile.schoolName')}
            value={schoolInfo?.name}
            colors={colors}
        />
        <InfoField
            label={t('profile.activePeriod')}
            value={schoolInfo?.activePeriod}
            colors={colors}
        />
        <InfoField
            label={t('profile.address')}
            value={schoolInfo?.address}
            colors={colors}
        />
    </View>
);

/** Tarjeta de dispositivo IoT para administrador */
const DeviceCard = ({ device, colors }) => {
    const styles = useMemo(() => createProfileStyles(colors), [colors]);
    const isActive = device?.status === 'Active';
    const statusColor = isActive ? colors.success : colors.danger;

    return (
        <View style={[styles.infoFieldContainerProfile, {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.text,
        }]}>
            <Text style={[styles.infoFieldLabelProfile, { color: colors.textSecondary }]}>
                {device?.classroom ?? '—'}
            </Text>
            <Text style={[styles.infoFieldValueProfile, { color: colors.text }]}>
                {device?.name ?? device?.device_name ?? '—'}
            </Text>
            <Text style={[styles.infoFieldLabelProfile, { color: statusColor, marginTop: 2 }]}>
                {device?.status ?? '—'}
            </Text>
        </View>
    );
};

// ─────────────────────────────────────────────
//  PANTALLA PRINCIPAL
// ─────────────────────────────────────────────

export default function ProfileScreen({ onLogout }) {
    const { t } = useTranslation();
    const { colors, theme } = useTheme();
    const styles = useMemo(() => createProfileStyles(colors), [colors]);


    const {
        userRole,
        userInfo,
        updateKey,
        handleBack,
        toggleTheme,
        reload,
        courses,
        attendanceStats,
        justifications,
        iotDevices,
        teacherSchedules,
        teacherCourseStats,
        schoolInfo,
    } = useProfileViewModel({ onLogout });

    const isStudent = (userRole || '').toLowerCase().includes('estudiante') || (userRole || '').toLowerCase().includes('student') || (userRole || '').toLowerCase().includes('aprendiz');
    const isTeacher = (userRole || '').toLowerCase().includes('docente') || (userRole || '').toLowerCase().includes('teacher') || (userRole || '').toLowerCase().includes('instructor');
    const isAdmin   = (userRole || '').toLowerCase().includes('admin');
    const isDark    = theme === 'dark';

    const initials = userInfo?.name
        ?.split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase() ?? '??';

    const avatarColor = isAdmin
        ? colors.primary
        : isTeacher
            ? colors.warning
            : colors.success;

    return (
        <SafeAreaView
            style={[styles.safeAreaWhite, { backgroundColor: colors.backgroundWhite }]}
            key={`${updateKey}`}
        >
            <ScrollView
                contentContainerStyle={styles.ScrollViewContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.container, { paddingHorizontal: 16 }]}>
                    <BackButton onPress={handleBack} />

                    {/* ══ HEADER / AVATAR ══ */}
                    <View style={[
                        styles.profileHeaderSectionProfile,
                        { marginTop: Platform.OS === 'ios' ? 8 : 30 },
                    ]}>
                        <View style={[styles.schoolInfoCardSchoolConfig, { marginTop: Platform.OS === 'ios' ? 10 : 25 }]}>
                            <View style={styles.schoolLogoContainerSchoolConfig}>
                                <Text style={styles.schoolLogoSchoolConfig}>{t('common.logoPlaceholder')}</Text>
                            </View>
                        </View>

                        <Text style={[styles.userNameProfile, { color: colors.text }]}>
                            {userInfo?.name ?? t('profile.noName')}
                        </Text>

                        <View style={[styles.roleBadgeProfile, {
                            backgroundColor: avatarColor + '15',
                            borderColor: avatarColor + '40',
                        }]}>
                            <View style={[styles.roleBadgeDotProfile, { backgroundColor: avatarColor }]} />
                            <Text style={[styles.roleBadgeTextProfile, { color: avatarColor }]}>
                                {userInfo?.role ?? t('profile.noRole')}
                            </Text>
                        </View>
                    </View>

                    {/* ══ INFORMACIÓN PERSONAL ══ */}
                    <SectionTitle
                        title={t('profile.personalInfo')}
                        colors={colors}
                    />
                    <InfoField label={t('profile.email')} value={userInfo?.email}          colors={colors} />
                    <InfoField label={t('profile.phone')}           value={userInfo?.phone}          colors={colors} />
                    <InfoField label={t('profile.employeeId')}          value={userInfo?.employeeId}     colors={colors} />
                    <InfoField label={t('profile.actorCode')}             value={userInfo?.actorCode}      colors={colors} />
                    <InfoField label={t('profile.joinDate')}   value={userInfo?.joinDate}       colors={colors} />
                    <InfoField label={t('profile.school')}            value={userInfo?.school}         colors={colors} />

                    {/* ══ SECCIÓN ESTUDIANTE ══ */}
                    {isStudent && (
                        <>
                            {/* Cursos matriculados */}
                            {courses?.length > 0 && (
                                <>
                                    <SectionTitle
                                        title={t('profile.enrolledCourses')}
                                        colors={colors}
                                        badge={courses.length}
                                    />
                                    {courses.map((course) => (
                                        <CourseCard
                                            key={course.id_enrollment ?? course.id_course ?? course.course_code}
                                            course={course}
                                            colors={colors}
                                        />
                                    ))}
                                </>
                            )}

                            {/* Estadísticas de asistencia */}
                            {attendanceStats && (
                                <>
                                    <SectionTitle
                                        title={t('profile.attendanceStats')}
                                        colors={colors}
                                    />
                                    <AttendanceStatsCard stats={attendanceStats} colors={colors} t={t} />
                                </>
                            )}

                            {/* Justificaciones */}
                            {justifications?.length > 0 && (
                                <>
                                    <SectionTitle
                                        title={t('profile.pendingJustifications')}
                                        colors={colors}
                                        badge={justifications.filter((j) => j?.approval === 'Pending').length}
                                    />
                                    {justifications.map((item) => (
                                        <JustificationCard
                                            key={item.id_justification ?? item.id}
                                            item={item}
                                            colors={colors}
                                            t={t}
                                        />
                                    ))}
                                </>
                            )}
                        </>
                    )}

                    {/* ══ SECCIÓN PROFESOR ══ */}
                    {isTeacher && (
                        <>
                            {/* Horario */}
                            {teacherSchedules?.length > 0 && (
                                <>
                                    <SectionTitle
                                        title={t('profile.teacherSchedule')}
                                        colors={colors}
                                        badge={teacherSchedules.length}
                                        badgeLabel={t('profile.classes')}
                                    />
                                    {teacherSchedules.map((sch) => (
                                        <TeacherScheduleCard
                                            key={sch.id_schedule}
                                            schedule={sch}
                                            colors={colors}
                                        />
                                    ))}
                                </>
                            )}

                            {/* Asistencia por curso */}
                            {teacherCourseStats?.length > 0 && (
                                <>
                                    <SectionTitle
                                        title={t('profile.courseAttendance')}
                                        colors={colors}
                                    />
                                    {teacherCourseStats.map((stat) => (
                                        <TeacherCourseStatCard
                                            key={stat.id_course ?? stat.course_code}
                                            courseStat={stat}
                                            colors={colors}
                                            t={t}
                                        />
                                    ))}
                                </>
                            )}
                        </>
                    )}

                    {/* ══ SECCIÓN ADMINISTRADOR ══ */}
                    {isAdmin && (
                        <>
                            {/* Información del colegio */}
                            {schoolInfo && (
                                <>
                                    <SectionTitle
                                        title={t('profile.schoolInfo')}
                                        colors={colors}
                                    />
                                    <SchoolInfoCard schoolInfo={schoolInfo} colors={colors} t={t} />
                                </>
                            )}

                            {/* Dispositivos IoT */}
                            {iotDevices?.length > 0 && (
                                <>
                                    <SectionTitle
                                        title={t('profile.iotDevices')}
                                        colors={colors}
                                        badge={iotDevices.filter((d) => d?.status === 'Active').length}
                                        badgeLabel={t('profile.active')}
                                    />
                                    {iotDevices.map((device) => (
                                        <DeviceCard
                                            key={device.id_device ?? device.id}
                                            device={device}
                                            colors={colors}
                                        />
                                    ))}
                                </>
                            )}
                        </>
                    )}

                    {/* ══ CONFIGURACIÓN RÁPIDA ══ */}
                    <View style={{ marginTop: 25 }}>
                        <SectionTitle
                            title={t('profile.quickSettings')}
                            colors={colors}
                        />

                        {/* Toggle de tema */}
                        <TouchableOpacity
                            style={[styles.profileSettingsButtonProfile, {
                                backgroundColor: colors.card,
                                borderColor:     colors.border,
                                shadowColor:     colors.text,
                            }]}
                            onPress={toggleTheme}
                            activeOpacity={0.75}
                        >
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.profileSettingsTitleProfile, { color: colors.text }]}>
                                    {t('settings.theme')}
                                </Text>
                                <Text style={[styles.profileSettingsSubtitleProfile, { color: colors.textSecondary }]}>
                                    {isDark
                                        ? t('settings.darkTheme')
                                        : t('settings.lightTheme')}
                                </Text>
                            </View>
                            <View style={[styles.settingsChevronProfile, {
                                backgroundColor: colors.primaryLight,
                            }]}>
                                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>
                                    {t('settings.changeTheme')}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.profileSettingsButtonProfile, {
                                backgroundColor: colors.card,
                                borderColor:     colors.border,
                                shadowColor:     colors.text,
                            }]}
                            activeOpacity={0.75}
                        >
                            <ProfileUpdateModal userInfo={userInfo} personId={userInfo?.personId} onSaved={reload} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.profileSettingsButtonProfile, {
                                backgroundColor: colors.card,
                                borderColor:     colors.border,
                                shadowColor:     colors.text,
                            }]}
                            activeOpacity={0.75}
                        >
                            <PasswordUpdateModal />
                        </TouchableOpacity>
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
