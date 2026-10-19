import React, {useMemo} from 'react';
import {SafeAreaView, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../components/common/ThemeContext';
import BottomBar from '../components/common/NavigationBar';
import ScrollViewWrapper from '../components/common/ScrollView';
import CustomTabs from '../components/common/CustomTabs';
import {createDashboardStyles} from './Styles/DashboardScreen/Style';
import {useDashboardViewModel} from '../../viewmodels/useDashboardViewModel';
import {useUser} from '../../utils/UserContext';

export default function Dashboard({ onLogout, userRole: propUserRole }) {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(() => createDashboardStyles(colors), [colors]);

    const {isTeacher, isStudent, currentUser} = useUser();

    const {
        userRole,
        isAdmin,
        updateKey,
        isLoading,
        formattedDate,
        menuAcciones,
        novedades,
        attendance,
        attendanceLabel,
        adminStats,
        studentStats,
        teacherStats,
        asistenciasRecientes,
        misRegistrosRecientes,
        handleLogoutPress,
        toggleTheme,
        theme,
    } = useDashboardViewModel({ onLogout, userRole: propUserRole });

    const recentRecordsList = (isAdmin || isTeacher) ? asistenciasRecientes : misRegistrosRecientes;

    return (
        <SafeAreaView
            style={[styles.safeArea, { backgroundColor: colors.background }]}
            key={`${updateKey}`}
        >
            <ScrollViewWrapper>
                <View style={[styles.container, { marginHorizontal: 15 }]}>
                    <CustomTabs userRole={userRole} onLogout={handleLogoutPress} />

                    <View style={styles.header}>
                        <View style={styles.dataBar}>
                            <View style={styles.leftContent}>
                                <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                                    {isAdmin
                                        ? t('dashboard.greeting')
                                        : isTeacher
                                            ? `${t('teacher.greeting')}`
                                            : `${t('student.greeting')}`
                                    }
                                </Text>

                                <Text style={[styles.adminName, { color: colors.text }]}>
                                    {currentUser?.name || t('userRole.administrator')}
                                </Text>

                                <Text style={[styles.date, { color: colors.textSecondary }]}>
                                    {formattedDate}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.attendanceIndicator, { backgroundColor: colors.card }]}>
                        <View style={styles.indicatorHeader}>
                            <Text style={[styles.sectionTitleAdmin, { color: colors.text }]}>
                                {attendanceLabel}
                            </Text>
                            <Text
                                style={[
                                    styles.percentageText,
                                    { color: theme === 'dark' ? colors.primary : colors.statusTextPresente },
                                ]}
                            >
                                {attendance}%
                            </Text>
                        </View>

                        <View style={[styles.progressBar, { backgroundColor: colors.progressBackground }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${attendance}%`,
                                        backgroundColor: theme === 'dark' ? colors.primary : colors.statusTextPresente,
                                    },
                                ]}
                            />
                        </View>

                        <View style={styles.indicatorDetails}>
                            <Text style={[styles.indicatorText, { color: colors.textSecondary }]}>
                                {isAdmin
                                    ? `${adminStats.presentesHoy} ${t('dashboard.employeesPresent')} ${adminStats.totalEmpleados} ${t('dashboard.employeesAttending')}`
                                    : isTeacher
                                        ? `${teacherStats?.presentesHoy ?? 0} ${t('teacher.studentsPresent')} ${teacherStats?.totalEstudiantes ?? 0} ${t('teacher.studentsAttending')}`
                                        : `${studentStats.clasesAsistidas} / ${studentStats.totalClases} ${t('student.classesAttended')}`}
                            </Text>
                        </View>
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        {isAdmin ? t('dashboard.quickActions') : isTeacher ? t('teacher.quickActions') : t('student.quickActions')}
                    </Text>

                    <View style={styles.quickActionsContainer}>
                        {menuAcciones.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.quickActionCard, { backgroundColor: colors.card }]}
                                onPress={() => {
                                    if (item.screen) navigation.navigate(item.screen);
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: item.color }]} />
                                <Text style={[styles.actionTitle, { color: colors.text }]}>{item.title}</Text>
                                <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                                    {item.description}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.recentSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                {isAdmin ? t('dashboard.recentAttendance') : isTeacher ? t('teacher.recentAttendance') : t('student.myRecentRecords')}
                            </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('DisplayingAttendance')}>
                                <Text style={[styles.seeAllText, { color: colors.primary }]}>
                                    {t('common.seeAll')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {recentRecordsList.map((item) => (
                            <View key={item.id} style={[styles.recentItem, { backgroundColor: colors.card }]}>
                                <View style={styles.recentInfo}>
                                    <Text style={[styles.recentName, { color: colors.text }]}>
                                        {/* Admin y Teacher ven nombres de personas, Student ve materias */}
                                        {(isAdmin || isTeacher) ? item.nombre : item.materia}
                                    </Text>
                                    <Text style={[styles.recentTime, { color: colors.textSecondary }]}>
                                        {(isAdmin || isTeacher) ? item.hora : `${item.fecha} - ${item.hora}`}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.statusBadge,
                                        item.estado === 'presente'
                                            ? { backgroundColor: colors.statusPresente }
                                            : { backgroundColor: colors.statusTarde },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusText,
                                            item.estado === 'presente'
                                                ? { color: colors.statusTextPresente }
                                                : { color: colors.statusTextTarde },
                                        ]}
                                    >
                                        {item.estado === 'presente'
                                            ? t('common.present')
                                            : t('common.late')}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={styles.novedadesSection}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            {isAdmin ? t('dashboard.recentNews') : isTeacher ? t('teacher.notifications') : t('student.notifications')}
                        </Text>
                        {novedades.map((item) => (
                            <View key={item.id} style={[styles.novedadCard, { backgroundColor: colors.card }]}>
                                <View style={[styles.novedadIcon, {backgroundColor: item.tipo === 'success' ? colors.novedadSuccess : item.tipo === 'warning' ? colors.novedadWarning : colors.novedadInfo,},]}/>
                                <View style={styles.novedadContent}>
                                    <Text style={[styles.novedadTitle, { color: colors.text }]}>{item.titulo}</Text>
                                    <Text style={[styles.novedadDescripcion, { color: colors.textSecondary }]}>
                                        {item.descripcion}
                                    </Text>
                                    <Text style={[styles.novedadTiempo, { color: colors.textMuted }]}>
                                        {item.tiempo}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={styles.bottomSpace} />
                </View>
            </ScrollViewWrapper>
            <BottomBar />
        </SafeAreaView>
    );
}