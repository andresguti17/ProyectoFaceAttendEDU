import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../view/components/common/ThemeContext';
import {getCurrentUserRole, getCurrentUser} from '../services/UserService';
import {ActorService} from '../services/ActorService';
import {normalizeBackendRole} from '../utils/getHighestRole';
import {JustificationService, getJustificationTypeMap, getAcademicActorMap, getAttendanceRecordCached, getPersonCached, mapConcurrent} from '../services/JustificationService';

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

export const JUSTIFICATION_TYPE = {
    ABSENCE: 'inasistencia',
    LATE: 'retardo',
};

export const USER_ROLE = {
    ADMIN: 'admin',
    TEACHER: 'teacher',
    STUDENT: 'student',
};

export const JUSTIFICATION_STATUS_INTERNAL = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
};

export const getInitials = (name = '') =>
    name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

// palette: paleta categórica del tema (colors.categorical); el índice es estable por nombre.
export const getAvatarColor = (name = '', palette) => {
    const index = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % palette.length;
    return palette[index];
};

export const getFileIcon = (mime = '') => {
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('image')) return '🖼️';
    if (mime.includes('word') || mime.includes('document')) return '📝';
    return '📎';
};

// Mismo mapper que el login (getHighestRole); rol desconocido o ausente bloquea el acceso.
const ROLE_KEYS = {Administrador: USER_ROLE.ADMIN, Instructor: USER_ROLE.TEACHER, Aprendiz: USER_ROLE.STUDENT};
const normalizeRole = (role) => ROLE_KEYS[normalizeBackendRole(role)] ?? null;

const getLocaleForLanguage = (lang) => {
    const localeMap = { es: 'es-CO', en: 'en-US', fr: 'fr-FR', pt: 'pt-BR' };
    return localeMap[lang?.split('-')[0]] || 'es-CO';
};

export const usePendingJustificationViewModel = () => {
    const {t, i18n} = useTranslation();
    const {colors} = useTheme();
    const currentLocale = getLocaleForLanguage(i18n.language);

    const [justifications, setJustifications] = useState([]);
    const [userRole, setUserRole] = useState(null);
    const [error, setError] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isModalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchJustifications = useCallback(async (role) => {
        try {
            setLoading(true);
            setError(null);

            const normalizedRole = normalizeRole(role);
            if (!normalizedRole) {
                console.error('usePendingJustification: rol no verificado, sin acceso');
                setJustifications([]);
                return;
            }
            let records;
            if (normalizedRole === USER_ROLE.STUDENT) {
                const user = await getCurrentUser();
                const actors = await ActorService.getByPerson(user?.personId);
                if (actors?.length > 0) {
                    const mine = [];
                    for (const actor of actors) {
                        mine.push(...await JustificationService.getByActor(actor.academicActorId));
                    }
                    records = mine;
                } else {
                    records = [];
                }
            } else if (normalizedRole === USER_ROLE.TEACHER) {
                // Para teachers: solo Pending + Approved, pedidas en paralelo.
                // Antes se descargaba TODO (getAll) y se filtraba en el
                // dispositivo, lo que colgaba la pantalla con volumen.
                // El servicio ya devuelve solo las de los aprendices de sus fichas.
                const [pending, approved] = await Promise.all([
                    JustificationService.getByStatus('Pending'),
                    JustificationService.getByStatus('Approved'),
                ]);
                records = [...pending, ...approved];
            } else {
                // ADMIN: traer todas
                records = await JustificationService.getAll();
            }

            const [typeMap, actorMap] = await Promise.all([getJustificationTypeMap(), getAcademicActorMap()]);

            const enriched = await mapConcurrent(records, async (j) => {
                // Accept both Justification models (camelCase) and raw rows (snake_case).
                const jd = {
                    justification_id: j.justificationId ?? j.justification_id,
                    justification_type_id: j.justificationTypeId ?? j.justification_type_id,
                    attendance_record_id: j.attendanceRecordId ?? j.attendance_record_id,
                    reason: j.reason,
                    submitted_at: j.submittedAt ?? j.submitted_at,
                    review_status: j.reviewStatus ?? j.review_status,
                };

                const ar = await getAttendanceRecordCached(jd.attendance_record_id);
                const actor = actorMap[String(ar?.academic_actor_id)] || {};
                const person = await getPersonCached(actor.person_id);

                const statusMap = { Pending: 'pending', Approved: 'approved', Rejected: 'rejected' };
                const jType = typeMap[jd.justification_type_id] || {};

                return {
                    id: String(jd.justification_id),
                    role: actor.actor_type_id === 1 ? USER_ROLE.STUDENT : USER_ROLE.TEACHER,
                    userName: `${person?.name || ''} ${person?.last_name || ''}`.trim(),
                    userCode: actor.actor_code || '—',
                    userGroup: '—',
                    type: /ret|late|tard/i.test(jType.name || '') ? 'retardo' : 'inasistencia',
                    date: jd.submitted_at ? jd.submitted_at.split('T')[0] : '',
                    time: null,
                    description: jd.reason || '',
                    attachment: null,
                    submittedAt: jd.submitted_at || '',
                    status: statusMap[jd.review_status] || 'pending',
                };
            });

            setJustifications(enriched);
        } catch (error) {
            console.error('Error fetching justifications:', error);
            setJustifications([]);
            setError(t('justifications.loadError'));
        } finally {
            setLoading(false);
        }
    }, []);

    const reload = useCallback(async () => {
        try {
            const role = await getCurrentUserRole();
            if (!role) {
                console.error('usePendingJustification: sin rol verificado');
                setUserRole(null);
                setJustifications([]);
                setError(t('justifications.loadError'));
                setLoading(false);
                return;
            }
            setUserRole(normalizeRole(role));
            await fetchJustifications(role);
        } catch (error) {
            console.error('Error cargando rol:', error);
            setUserRole(null);
            setJustifications([]);
            setError(t('justifications.loadError'));
            setLoading(false);
        }
    }, [fetchJustifications]);

    useEffect(() => {
        reload();
    }, [reload]);

    const baseJustifications = useMemo(() => {
        if (!userRole) return [];
        if (userRole === USER_ROLE.TEACHER) {
            return justifications.filter((j) => j.role === USER_ROLE.STUDENT);
        }
        return justifications;
    }, [justifications, userRole]);

    const filtered = useMemo(() => {
        if (userRole === USER_ROLE.ADMIN && activeFilter !== 'all') {
            return baseJustifications.filter((j) => j.role === activeFilter);
        }
        // Para TEACHER, filtrar también por estado cuando activeFilter no es 'all'
        if (userRole === USER_ROLE.TEACHER && activeFilter !== 'all') {
            return baseJustifications.filter((j) => j.status === activeFilter);
        }
        return baseJustifications;
    }, [baseJustifications, activeFilter, userRole]);

    const openDetail = useCallback((item) => { setSelectedItem(item); setModalVisible(true); }, []);
    const closeDetail = useCallback(() => { setModalVisible(false); setTimeout(() => setSelectedItem(null), 300); }, []);

    const canReview = userRole === USER_ROLE.ADMIN || userRole === USER_ROLE.TEACHER;

    const approveJustification = useCallback(async (id) => {
        if (!canReview) return;
        const reviewer = await getCurrentUser();
        const updated = await JustificationService.approve(id, reviewer?.userId);
        if (updated) {
            setJustifications((prev) => prev.map((j) => j.id === id ? {...j, status: JUSTIFICATION_STATUS_INTERNAL.APPROVED} : j));
            closeDetail();
        }
    }, [closeDetail, canReview]);

    const rejectJustification = useCallback(async (id, notes) => {
        if (!canReview) return;
        const reviewer = await getCurrentUser();
        const updated = await JustificationService.reject(id, reviewer?.userId, notes);
        if (updated) {
            setJustifications((prev) => prev.map((j) => j.id === id ? {...j, status: JUSTIFICATION_STATUS_INTERNAL.REJECTED} : j));
            closeDetail();
        }
    }, [closeDetail, canReview]);

    const counts = useMemo(() => {
        if (userRole === USER_ROLE.TEACHER) {
            const pending = justifications.filter(j => j.status === 'pending').length;
            const approved = justifications.filter(j => j.status === 'approved').length;
            return {all: justifications.length, pending, approved};
        }
        if (userRole === USER_ROLE.STUDENT) {
            return {all: baseJustifications.length};
        }
        return {
            all: justifications.length,
            student: justifications.filter((j) => j.role === USER_ROLE.STUDENT).length,
            teacher: justifications.filter((j) => j.role === USER_ROLE.TEACHER).length,
        };
    }, [justifications, baseJustifications, userRole]);

    const formatDate = useCallback((isoDate = '') => {
        if (!isoDate) return '—';
        try {
            const date = new Date(isoDate + 'T00:00:00');
            return date.toLocaleDateString(currentLocale, { day: 'numeric', month: 'short', year: 'numeric' });
        } catch { return '—'; }
    }, [currentLocale]);

    const getTypeLabel = useCallback((type) =>
        type === JUSTIFICATION_TYPE.ABSENCE ? t('justificationType.absence') : t('justificationType.late'), [t]);

    const getTypeColors = useCallback((type) =>
        type === JUSTIFICATION_TYPE.ABSENCE
            ? {bg: colors.statusTarde, text: colors.statusTextTarde}
            : {bg: colors.badgeBackground, text: colors.badgeText}, [colors]);

    const getRoleLabel = useCallback((role) =>
        role === USER_ROLE.STUDENT ? t('userRole.student') : t('userRole.teacher'), [t]);

    const getRoleColors = useCallback((role) =>
        role === USER_ROLE.STUDENT
            ? {bg: colors.categoryBackground, text: colors.categoryText}
            : {bg: colors.statusPresente, text: colors.statusTextPresente}, [colors]);

    return {
        filtered, selectedItem, counts, activeFilter, userRole, loading, error, reload,
        loadingRole: !userRole,
        isModalVisible, openDetail, closeDetail,
        approveJustification, rejectJustification, setActiveFilter,
        getInitials, getAvatarColor, formatDate, getFileIcon,
        getTypeLabel, getTypeColors, getRoleLabel, getRoleColors,
    };
};
