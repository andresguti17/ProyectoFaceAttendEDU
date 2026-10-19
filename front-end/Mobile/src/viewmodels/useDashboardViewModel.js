import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../view/components/common/ThemeContext';
import {getHighestRole} from '../utils/getHighestRole';
import {useFocusEffect} from '@react-navigation/native';
import {getCurrentUserRole, getCurrentUser, isSuperAdmin as checkIsSuperAdmin} from "../services/UserService";
import {ActorService} from '../services/ActorService';
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {backendGet} from '../api/backend';
import {loadScopedAlerts} from '../services/alertFeed';
import ENV from '../config/env';

const ATT = () => ENV.ATTENDANCE_BASE_URL;
const SCHED = () => ENV.SCHEDULING_BASE_URL;
const ACAD = () => ENV.ACADEMIC_BASE_URL;

// Una lista que falla devuelve [] en vez de tumbar la sección: el dashboard
// pinta ceros parciales en lugar de quedarse sin datos por un timeout.
async function safeList(promise) {
  try {
    const list = await promise;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveTimeLocale(language) {
  if (language === 'en') return 'en-US';
  if (language === 'pt') return 'pt-BR';
  if (language === 'fr') return 'fr-FR';
  return 'es-ES';
}

function formatRelativeTime(isoDate, t) {
  if (!isoDate) return '';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.max(Math.floor(diffMs / 60000), 0);
  if (mins < 60) return `${t('dashboard.ago')} ${mins} ${t('dashboard.minutesAgo')}`;
  const hours = Math.floor(mins / 60);
  return `${t('dashboard.ago')} ${hours} ${t('dashboard.hoursAgo')}`;
}

async function getCourseNameForRecord(record) {
  try {
    const sessions = await backendGet(SCHED(), `api/v1/class-sessions/${record.class_session_id}`);
    const session = sessions[0];
    if (!session?.schedule_block_id) return '';
    const blocks = await backendGet(SCHED(), `api/v1/schedule-blocks/${session.schedule_block_id}`);
    const block = blocks[0];
    if (!block?.course_id) return '';
    const courses = await backendGet(ACAD(), `api/v1/courses/${block.course_id}`);
    const course = courses[0];
    return course?.name || course?.code || '';
  } catch {
    return '';
  }
}

// Últimas alertas con el mismo alcance por rol que Novedades (antes cualquier
// rol veía las de toda la institución con nombres).
async function fetchRecentNovedades(t) {
  try {
    return (await loadScopedAlerts()).slice(0, 5).map((a) => ({
      id: a.id,
      titulo: a.title,
      descripcion: a.person,
      tiempo: formatRelativeTime(a.raisedAt, t),
      tipo: a.resolved ? 'success' : 'warning',
    }));
  } catch {
    return [];
  }
}

export function useDashboardViewModel({ onLogout, userRole: propUserRole } = {}) {
    const {t, i18n} = useTranslation();
    const {colors, loadThemeForRole, toggleTheme, theme} = useTheme();

    const [userRole, setUserRole] = useState(propUserRole || null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const updateKey = useLanguageRefresh();
    const [isLoading, setIsLoading] = useState(false);

    const [adminStats, setAdminStats] = useState({
        totalEmpleados: 0,
        presentesHoy: 0,
        ausentesHoy: 0,
        tardanzasHoy: 0,
        porcentajeAsistencia: 0,
    });
    const [studentStats, setStudentStats] = useState({
        miAsistencia: 0,
        totalClases: 0,
        clasesAsistidas: 0,
        faltas: 0,
        retardos: 0,
    });
    const [teacherStats, setTeacherStats] = useState({
        presentesHoy: 0,
        totalEstudiantes: 0,
        clasesImpartidasHoy: 0,
        justificacionesPendientes: 0,
        porcentajeAsistencia: 0,
    });

    const [asistenciasRecientes, setAsistenciasRecientes] = useState([]);
    const [misRegistrosRecientes, setMisRegistrosRecientes] = useState([]);
    const [novedades, setNovedades] = useState([]);

    const loadUserData = useCallback(async () => {
        try {
            let role = propUserRole;
            if (!role) {
                role = await getCurrentUserRole();
                if (role) {
                    try {
                        const parsed = JSON.parse(role);
                        if (Array.isArray(parsed)) {
                            role = getHighestRole(parsed);
                        }
                    } catch {}
                }
            }
            setUserRole(role);
            if (role) {
                await loadThemeForRole(role);
            }
            try {
                setIsSuperAdmin(await checkIsSuperAdmin());
            } catch {}
        } catch (error) {
            console.error('Error cargando datos de usuario:', error);
        }
    }, [propUserRole, loadThemeForRole]);

    useFocusEffect(
        useCallback(() => {
            loadUserData();
        }, [loadUserData])
    );

    const roleLower = String(userRole || '').toLowerCase();
    const isAdmin = roleLower === 'administrador' || roleLower === 'admin';
    const isTeacher = roleLower === 'teacher' || roleLower === 'docente' || roleLower === 'instructor';

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const timeLocale = resolveTimeLocale(i18n.language);
                const currentUser = await getCurrentUser();
                const userEmail = currentUser?.email;

                let studentActorId = null;
                if (!isAdmin && userEmail) {
                    const user = await getCurrentUser();
                    const actors = await ActorService.getByPerson(user?.personId);
                    if (actors?.length > 0) {
                        studentActorId = actors[0].academicActorId;
                    }
                }

                if (isAdmin) {
                    // Paginado (caché): la tabla completa son decenas de miles de
                    // filas y tumba la petición en el dispositivo (timeout).
                    try {
                        const records = await backendGet(ATT(), 'api/v1/attendance-records', {page: 1, limit: 200}, { useCache: true });
                    // "Hoy" es hoy: antes se mezclaban registros de cualquier fecha
                    // en los contadores y el porcentaje (el backend no pagina ni
                    // filtra por fecha). Sin registros de hoy se usa el global.
                    const todayKeyAdmin = formatDateKey(new Date());
                    const dayRecords = records.filter((r) => (r.captured_at || '').slice(0, 10) === todayKeyAdmin);
                    const base = dayRecords.length > 0 ? dayRecords : records;
                    const present = base.filter(r => r.attendance_status === 'Present').length;
                    const absent = base.filter(r => r.attendance_status === 'Absent').length;
                    const late = base.filter(r => r.attendance_status === 'Late').length;
                    const total = base.length || 1;

                    // "Profesores presentes": instructores (actor_type_id 2) que
                    // abrieron al menos una sesión de clase hoy, sobre el total
                    // de instructores — antes se mezclaban estudiantes y
                    // registros de cualquier fecha (attendance-records sin filtro
                    // de fecha ni de tipo de actor).
                    const [instructorsRaw, sessionsToday] = await Promise.all([
                        backendGet(ACAD(), 'api/v1/academic-actors', { limit: 2000 }, { useCache: true }),
                        backendGet(SCHED(), 'api/v1/class-sessions', {}, { useCache: true }),
                    ]);
                    const totalInstructors = instructorsRaw.filter((a) => a.actor_type_id === 2).length;
                    const instructorsPresentToday = new Set(
                        sessionsToday
                            .filter((s) => s.session_date === todayKeyAdmin && s.opened_by != null)
                            .map((s) => s.opened_by)
                    ).size;

                    setAdminStats({
                        totalEmpleados: totalInstructors,
                        presentesHoy: instructorsPresentToday,
                        ausentesHoy: absent,
                        tardanzasHoy: late,
                        porcentajeAsistencia: Math.round((present / total) * 100),
                    });

                    const recentRecords = records.slice(-4).reverse().map((r, i) => ({
                        id: i + 1,
                        nombre: t('attendance.unknownRecord', {id: r.attendance_record_id}),
                        hora: r.captured_at ? new Date(r.captured_at).toLocaleTimeString(timeLocale, {hour: '2-digit', minute: '2-digit'}) : '—',
                        estado: r.attendance_status === 'Present' ? 'presente' : r.attendance_status === 'Late' ? 'tarde' : 'ausente',
                    }));
                    setAsistenciasRecientes(recentRecords);
                    } catch (sectionError) {
                        console.error('Error fetching admin dashboard section:', sectionError);
                    }
                } else if (isTeacher) {
                    try {
                    const user = await getCurrentUser();
                    const actors = await ActorService.getByPerson(user?.personId);
                    const myActor = actors?.length > 0 ? actors[0] : null;

                    let teacherRecords = [];
                    let sessionsTodayCount = 0;
                    const todayKey = formatDateKey(new Date());
                    if (myActor) {
                        const blocks = await safeList(backendGet(SCHED(), 'api/v1/schedule-blocks', { instructorActorId: myActor.academicActorId }));
                        const sessionsNested = await Promise.all(
                            blocks.map((block) => safeList(backendGet(SCHED(), 'api/v1/class-sessions', { scheduleBlockId: block.schedule_block_id })))
                        );
                        const sessions = sessionsNested.flat();
                        sessionsTodayCount = sessions.filter((s) => s.session_date === todayKey).length;
                        const recordsNested = await Promise.all(
                            sessions.map((session) => safeList(backendGet(ATT(), 'api/v1/attendance-records', { classSessionId: session.class_session_id })))
                        );
                        teacherRecords = recordsNested.flat();
                    }

                    // Igual que admin: el porcentaje es de hoy (con fallback al
                    // global si aún no hay registros hoy).
                    const teacherDayRecords = teacherRecords.filter((r) => (r.captured_at || '').slice(0, 10) === todayKey);
                    const teacherBase = teacherDayRecords.length > 0 ? teacherDayRecords : teacherRecords;
                    const present = teacherBase.filter(r => r.attendance_status === 'Present').length;
                    const total = teacherBase.length || 1;

                    let pendingJustifications = 0;
                    try {
                        pendingJustifications = (await backendGet(ATT(), 'api/v1/justifications', { status: 'Pending' })).length;
                    } catch {}

                    setTeacherStats({
                        presentesHoy: present,
                        totalEstudiantes: total,
                        clasesImpartidasHoy: sessionsTodayCount,
                        justificacionesPendientes: pendingJustifications,
                        porcentajeAsistencia: Math.round((present / total) * 100),
                    });

                    const recentRecords = teacherRecords.slice(-4).reverse().map((r, i) => ({
                        id: i + 1,
                        nombre: t('attendance.unknownRecord', {id: r.attendance_record_id}),
                        hora: r.captured_at ? new Date(r.captured_at).toLocaleTimeString(timeLocale, {hour: '2-digit', minute: '2-digit'}) : '—',
                        estado: r.attendance_status === 'Present' ? 'presente' : r.attendance_status === 'Late' ? 'tarde' : 'ausente',
                    }));
                    setAsistenciasRecientes(recentRecords);
                    } catch (sectionError) {
                        console.error('Error fetching teacher dashboard section:', sectionError);
                    }
                } else {
                    try {
                    const records = studentActorId
                        ? await backendGet(ATT(), 'api/v1/attendance-records', { academicActorId: studentActorId })
                        : [];
                    const present = records.filter(r => r.attendance_status === 'Present').length;
                    const total = records.length || 1;
                    setStudentStats({
                        miAsistencia: Math.round((present / total) * 100),
                        totalClases: total,
                        clasesAsistidas: present,
                        faltas: records.filter(r => r.attendance_status === 'Absent').length,
                        retardos: records.filter(r => r.attendance_status === 'Late').length,
                    });

                    const recentSlice = records.slice(-4).reverse();
                    const courseNames = await Promise.all(recentSlice.map((r) => getCourseNameForRecord(r)));
                    const myRecords = recentSlice.map((r, i) => {
                        const courseName = courseNames[i];
                        return {
                            id: r.attendance_record_id ?? i + 1,
                            materia: courseName || '—',
                            hora: r.captured_at ? new Date(r.captured_at).toLocaleTimeString(timeLocale, {hour: '2-digit', minute: '2-digit'}) : '—',
                            estado: r.attendance_status === 'Present' ? 'presente' : 'ausente',
                            fecha: r.captured_at ? r.captured_at.split('T')[0] : '—',
                        };
                    });
                    setMisRegistrosRecientes(myRecords);
                    } catch (sectionError) {
                        console.error('Error fetching student dashboard section:', sectionError);
                    }
                }

                try {
                    setNovedades(await fetchRecentNovedades(t));
                } catch (sectionError) {
                    console.error('Error fetching dashboard news section:', sectionError);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        if (userRole) {
            fetchDashboardData();
        }
    }, [userRole, isAdmin, isTeacher, t, i18n.language]);

    const currentLocale = resolveTimeLocale(i18n.language);
    const formattedDate = new Date().toLocaleDateString(currentLocale, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    // Colores de categoría tomados de la paleta activa (posición estable entre paletas).
    const cat = colors.categorical;
    const menuAccionesAdmin = [
        { id: 1, title: t('dashboard.manageUsers'), description: t('dashboard.manageUsersDesc'), color: cat[0], screen: 'ManageUsersScreen' },
        { id: 2, title: t('dashboard.environmentManagement'), description: t('dashboard.manageEnvironmentDesc'), color: cat[1], screen: 'ManageEnviromentScreen' },
        { id: 3, title: t('dashboard.reports'), description: t('dashboard.reportsDesc'), color: cat[2], screen: 'AttendanceReportScreen' },
        ...(isSuperAdmin
            ? [{ id: 4, title: t('schools.title'), description: t('schools.subtitle'), color: cat[3], screen: 'Schools' }]
            : []),
        { id: 5, title: t('dashboard.news'), description: t('dashboard.newsDesc'), color: cat[4], screen: 'Novedades' },
        { id: 6, title: t('dashboard.schoolConfig'), description: t('dashboard.schoolConfigDesc'), color: cat[5], screen: 'SchoolConfigurationScreen' },
        { id: 7, title: t('biometricCases.title'), description: t('biometricCases.menuDesc'), color: cat[2], screen: 'BiometricCasesScreen' },
        { id: 8, title: t('dashboard.justifications'), description: t('dashboard.justificationsDesc'), color: cat[4], screen: 'MenuJustify' },
    ];
    const menuAccionesEstudiante = [
        { id: 1, title: t('student.registerFace'), description: t('student.registerFaceDesc'), color: cat[0], screen: 'RegisterFace' },
        { id: 2, title: t('student.myAttendance'), description: t('student.myAttendanceDesc'), color: cat[1], screen: 'DisplayingAttendance' },
        { id: 3, title: t('student.myCourses'), description: t('student.myCoursesDesc'), color: cat[2], screen: 'MyCourses' },
        { id: 4, title: t('student.myJustifications'), description: t('student.myJustificationsDesc'), color: cat[3], screen: 'MenuJustify' },
        { id: 5, title: t('student.UpdateFace'), description: t('student.UpdateFaceDesc'), color: cat[4], screen: 'UpdatePhoto' },
        { id: 6, title: t('dashboard.news'), description: t('dashboard.newsDesc'), color: cat[5], screen: 'Novedades' },
    ];
    const menuAccionesDocente = [
        { id: 1, title: t('teacher.updateFace'), description: t('teacher.updateFaceDesc'), color: cat[0], screen: 'UpdatePhoto' },
        { id: 2, title: t('teacher.myAttendance'), description: t('teacher.myAttendanceDesc'), color: cat[1], screen: 'DisplayingAttendance' },
        { id: 3, title: t('teacher.myCourses'), description: t('teacher.myCoursesDesc'), color: cat[2], screen: 'MyCourses' },
        { id: 4, title: t('teacher.pendingJustifications'), description: t('teacher.pendingJustificationsDesc'), color: cat[3], screen: 'PendingJustificationScreen' },
        { id: 5, title: t('student.registerFace'), description: t('student.registerFaceDesc'), color: cat[4], screen: 'RegisterFace' },
        { id: 6, title: t('dashboard.reports'), description: t('teacher.reportsDesc'), color: cat[5], screen: 'AttendanceReportScreen' },
        { id: 7, title: t('dashboard.news'), description: t('dashboard.newsDesc'), color: cat[0], screen: 'Novedades' },
        { id: 8, title: t('biometricCases.title'), description: t('biometricCases.menuDesc'), color: cat[2], screen: 'BiometricCasesScreen' },
    ];

    const menuAcciones = isAdmin ? menuAccionesAdmin : isTeacher ? menuAccionesDocente : menuAccionesEstudiante;
    const attendance = isAdmin ? adminStats.porcentajeAsistencia : isTeacher ? teacherStats.porcentajeAsistencia : studentStats.miAsistencia;
    const attendanceLabel = isAdmin ? t('dashboard.attendance') : isTeacher ? t('teacher.attendanceLabel') : t('student.myAttendance');

    const handleLogoutPress = async () => {
        if (onLogout) {
            setIsLoading(true);
            try { await onLogout(); } catch (error) { console.error('Error en logout:', error); } finally { setIsLoading(false); }
        }
    };

    return {
        userRole, isAdmin, isTeacher, isSuperAdmin, updateKey, isLoading, formattedDate,
        menuAcciones, novedades, attendance, attendanceLabel,
        adminStats, studentStats, teacherStats,
        asistenciasRecientes, misRegistrosRecientes,
        handleLogoutPress, loadUserData, toggleTheme, theme,
    };
}
