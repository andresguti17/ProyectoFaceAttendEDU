import {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {saveLanguageForRole} from '../view/components/common/languageByRole';
import {useTheme} from '../view/components/common/ThemeContext';
import {getCurrentUserRole, getCurrentUser} from "../services/UserService";
import {ActorService} from '../services/ActorService';
import {SchoolService} from '../services/SchoolService';
import {PeriodService} from '../services/PeriodService';
import {backendGet} from '../api/backend';
import ENV from '../config/env';
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {removeToken} from '../storage/TokenStorage';
import {loadStudentProfileSections, loadTeacherProfileSections} from '../services/profileData';
import {getDayLabel, resolveLocale} from './useDisplayingAttendanceViewModel';

const EMPTY_SECTIONS = {
    courses: [],
    attendanceStats: null,
    justifications: [],
    teacherSchedules: [],
    teacherCourseStats: [],
};

// Misma regla de roles que ProfileScreen usa para mostrar cada sección.
const roleIncludes = (role, ...names) => names.some((n) => (role || '').toLowerCase().includes(n));

export function useProfileViewModel({ onLogout } = {}) {
    const navigation = useNavigation();
    const {t, i18n} = useTranslation();
    const {theme, toggleTheme, loadThemeForRole} = useTheme();

    const [userRole, setUserRole] = useState(null);
    const updateKey = useLanguageRefresh();
    const [isLoading, setIsLoading] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState(null);
    const [sections, setSections] = useState(EMPTY_SECTIONS);
    const [userInfo, setUserInfo] = useState({
        personId: null,
        name: '',
        email: '',
        phone: '',
        role: '',
        joinDate: '',
        school: '',
        employeeId: '',
        actorCode: '',
    });

    const formatJoinDate = (raw) => {
        if (!raw) return '';
        const date = raw instanceof Date ? raw : new Date(raw);
        if (Number.isNaN(date.getTime())) return '';
        try {
            return date.toLocaleDateString(i18n.language || 'es', {day: '2-digit', month: 'short', year: 'numeric'});
        } catch {
            return date.toLocaleDateString('es', {day: '2-digit', month: 'short', year: 'numeric'});
        }
    };

    // Cargar datos del usuario al recibir foco:
    // persona (nombre/teléfono) -> actor académico -> colegio.
    const loadUserData = useCallback(async () => {
        try {
            const current = await getCurrentUser();
            const role = await getCurrentUserRole();
            if (role) {
                setUserRole(role);
                await loadThemeForRole(role);
            }

            let person = null;
            if (current?.personId) {
                try {
                    const arr = await backendGet(ENV.API_BASE_URL, `api/v1/persons/${current.personId}`);
                    person = arr[0] || null;
                } catch {}
            }

            // Fecha de ingreso: inicio del vínculo académico; si no hay
            // actor (p. ej. admin), creación del usuario en identity.
            let userCreatedAt = null;
            if (current?.userId) {
                try {
                    const arr = await backendGet(ENV.API_BASE_URL, `api/v1/users/${current.userId}`);
                    userCreatedAt = arr[0]?.created_at || null;
                } catch {}
            }

            let schoolName = '';
            let academicActorId = null;
            let actorCode = '';
            let joinDate = '';
            let loadedSchoolInfo = null;
            if (person?.person_id) {
                try {
                    const actors = await ActorService.getByPerson(person.person_id);
                    // Actor acorde al rol (un usuario puede tener varios): 1 aprendiz, 2 instructor.
                    const kind = String(role || "").toLowerCase();
                    const wantType = kind.includes("docente") || kind.includes("teacher") || kind.includes("instructor") ? 2
                        : kind.includes("estudiante") || kind.includes("student") || kind.includes("aprendiz") ? 1
                        : null;
                    const actor = (wantType != null ? actors?.find((a) => a?.actorTypeId === wantType) : null) || actors?.[0] || null;
                    academicActorId = actor?.academicActorId || null;
                    actorCode = actor?.actorCode || '';
                    joinDate = formatJoinDate(actor?.startedOn || userCreatedAt);
                    const schoolId = actor?.schoolId || null;
                    if (schoolId) {
                        const school = await SchoolService.getById(schoolId);
                        schoolName = school?.name || '';
                        const activePeriod = await PeriodService.getActiveBySchool(schoolId);
                        loadedSchoolInfo = {
                            name: school?.name || '',
                            address: school?.address || '',
                            activePeriod: activePeriod?.name || '',
                        };
                    } else {
                        // Sin actor académico (p. ej. admin): escuela con
                        // más actores (la sede principal) para no dejar
                        // el perfil vacío.
                        const schools = await SchoolService.getAll();
                        let school = schools?.[0] || null;
                        try {
                            const counts = {};
                            for (const a of (await ActorService.getAll()) || []) {
                                if (a?.schoolId != null) counts[a.schoolId] = (counts[a.schoolId] || 0) + 1;
                            }
                            const top = Object.entries(counts).sort((x, y) => y[1] - x[1] || Number(x[0]) - Number(y[0]))[0];
                            const found = top ? schools?.find((s) => String(s?.schoolId) === String(top[0])) : null;
                            if (found) school = found;
                        } catch {}
                        if (school?.schoolId) {
                            schoolName = school?.name || '';
                            const activePeriod = await PeriodService.getActiveBySchool(school.schoolId);
                            loadedSchoolInfo = {
                                name: school?.name || '',
                                address: school?.address || '',
                                activePeriod: activePeriod?.name || '',
                            };
                        }
                    }
                } catch {}
            }
            setSchoolInfo(loadedSchoolInfo);

            setUserInfo({
                personId: person?.person_id || current?.personId || null,
                name: `${person?.name || ''} ${person?.last_name || ''}`.trim() || current?.username || current?.name || '',
                email: person?.email || current?.email || '',
                phone: person?.phone || '',
                role: role || '',
                joinDate,
                school: schoolName,
                employeeId: person?.document_number || '',
                actorCode,
            });

            if (roleIncludes(role, 'estudiante', 'student', 'aprendiz')) {
                setSections({...EMPTY_SECTIONS, ...(await loadStudentProfileSections(academicActorId))});
            } else if (roleIncludes(role, 'docente', 'teacher', 'instructor')) {
                const locale = resolveLocale(i18n.language);
                const dayLabel = (day) => getDayLabel(day, locale);
                setSections({...EMPTY_SECTIONS, ...(await loadTeacherProfileSections(academicActorId, dayLabel))});
            } else {
                setSections(EMPTY_SECTIONS);
            }
        } catch (error) {
            console.error('Error cargando datos de usuario:', error);
        }
    }, [loadThemeForRole, i18n.language]);

    useFocusEffect(
        useCallback(() => {
            loadUserData();
        }, [loadUserData])
    );

    const handleBack = useCallback(() => navigation.goBack(), [navigation]);

    // Acción real de cerrar sesión (sin confirmación).
    // Delega en onLogout (AppNavigator) para voltear isAuthenticated;
    // sin él, solo limpia la sesión sin navegar a rutas de otro stack.
    const performLogout = useCallback(async () => {
        setIsLoading(true);
        try {
            if (userRole) {
                await saveLanguageForRole(userRole, i18n.language);
            }
            await removeToken();
            await AsyncStorage.multiRemove(['userRole', 'userEmail', 'userProfile']);
            if (onLogout) {
                await onLogout();
            }
        } catch (error) {
            console.error('Error en logout:', error);
            throw error; // La pantalla mostrará el error con CustomAlert
        } finally {
            setIsLoading(false);
        }
    }, [userRole, i18n.language, onLogout]);

    return {
        userRole,
        userInfo,
        updateKey,
        isLoading,
        handleBack,
        performLogout,
        toggleTheme,
        reload: loadUserData,
        ...sections,
        // Sin backend de dispositivos IoT: la sección queda oculta.
        iotDevices: [],
        schoolInfo,
    };
}