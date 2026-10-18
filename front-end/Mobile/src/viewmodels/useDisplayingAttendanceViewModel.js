import {useCallback, useEffect, useState} from "react";
import {Platform} from "react-native";
import {useTranslation} from "react-i18next";
import {useLanguageRefresh} from "../utils/useLanguageRefresh";
import {useTheme} from "../view/components/common/ThemeContext";
import {getCurrentUserRole, getCurrentUser} from "../services/UserService";
import {ActorService} from "../services/ActorService";
import {PeriodService} from "../services/PeriodService";
import {JustificationService} from "../services/JustificationService";
import {backendGet} from "../api/backend";
import ENV from "../config/env";
import {filterAttendance} from "../utils/attendanceFilters";

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

// Una petición que falla no tumba el registro: devuelve null y el campo
// se pinta '—'. Antes un solo 404 descartaba el registro entero (continue).
async function safe(promise) {
  try {
    return await promise;
  } catch {
    return null;
  }
}

// Registros recientes a enriquecer y tamaño del lote paralelo. 50
// registros x ~7 peticiones secuenciales colgaban el dispositivo (timeout);
// por lotes de 10 con lecturas independientes en paralelo el mismo trabajo
// baja de minutos a segundos en red local.
const RECENT_LIMIT = 50;
const ENRICH_CHUNK_SIZE = 10;

async function enrichRecord(record, { locale, t, activePeriod, justificationsByRecord }) {
  try {
    const [sessionData, actorData] = await Promise.all([
      record.class_session_id
        ? safe(backendGet(ENV.SCHEDULING_BASE_URL, `api/v1/class-sessions/${record.class_session_id}`))
        : null,
      record.academic_actor_id
        ? safe(backendGet(ENV.ACADEMIC_BASE_URL, `api/v1/academic-actors/${record.academic_actor_id}`))
        : null,
    ]);
    const session = unwrap(sessionData)[0] || {};
    const actor = unwrap(actorData)[0] || {};

    const [blockData, personData] = await Promise.all([
      session.schedule_block_id
        ? safe(backendGet(ENV.SCHEDULING_BASE_URL, `api/v1/schedule-blocks/${session.schedule_block_id}`))
        : null,
      actor.person_id
        ? safe(backendGet(ENV.API_BASE_URL, `api/v1/persons/${actor.person_id}`))
        : null,
    ]);
    const block = unwrap(blockData)[0] || {};
    const person = unwrap(personData)[0] || {};

    const [courseData, envData, instrActorData] = await Promise.all([
      block.course_id
        ? safe(backendGet(ENV.ACADEMIC_BASE_URL, `api/v1/courses/${block.course_id}`))
        : null,
      block.environment_id
        ? safe(backendGet(ENV.SCHEDULING_BASE_URL, `api/v1/environments/${block.environment_id}`))
        : null,
      block.instructor_actor_id
        ? safe(backendGet(ENV.ACADEMIC_BASE_URL, `api/v1/academic-actors/${block.instructor_actor_id}`))
        : null,
    ]);
    const course = unwrap(courseData)[0] || {};
    const env = unwrap(envData)[0] || {};
    const instrActor = unwrap(instrActorData)[0] || {};

    let docenteName = '—';
    if (instrActor?.person_id) {
      const instrPersonData = await safe(backendGet(ENV.API_BASE_URL, `api/v1/persons/${instrActor.person_id}`));
      const instrPerson = unwrap(instrPersonData)[0];
      if (instrPerson) {
        docenteName = `${instrPerson.name || ''} ${instrPerson.last_name || ''}`.trim() || '—';
      }
    }

    const statusMap = { Present: 'presente', Late: 'tarde', Absent: 'ausente', Justified: 'justificado' };
    const justification = justificationsByRecord?.get(String(record.attendance_record_id));
    // Una inasistencia no tiene captured_at: su fecha es la de la sesión, no created_at (fecha de carga).
    const when = record.captured_at || null;
    const hora = when ? new Date(when).toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'}) : '—';

    return {
      id: record.attendance_record_id,
      nombre: `${person.name || ''} ${person.last_name || ''}`.trim() || t('attendance.unknownPerson', {id: record.academic_actor_id}),
      fecha: session.session_date || (when ? when.split('T')[0] : ''),
      hora,
      estado: statusMap[record.attendance_status] || 'ausente',
      materia: course.name || course.code || '—',
      codigo_curso: course.code || '—',
      dia: getDayLabel(block.day_of_week, locale),
      hora_inicio: block.starts_at || '—',
      hora_fin: block.ends_at || '—',
      salon: env.name || '—',
      periodo: activePeriod?.name || '—',
      periodo_inicio: activePeriod?.startsOn || '—',
      periodo_fin: activePeriod?.endsOn || '—',
      docente: docenteName,
      // ERF 7.4: estado de la justificación asociada al registro, si existe.
      justificacion: justification ? {
        estado: justification.reviewStatus,
        texto: justification.reason || '—',
        revisado_en: justification.reviewedAt ? String(justification.reviewedAt).split('T')[0] : '—',
      } : null,
    };
  } catch (e) {
    return null;
  }
}

async function enrichRecords(records, ctx) {
  const enriched = [];
  const recent = records.slice(-RECENT_LIMIT);
  for (let i = 0; i < recent.length; i += ENRICH_CHUNK_SIZE) {
    const chunk = await Promise.all(recent.slice(i, i + ENRICH_CHUNK_SIZE).map((r) => enrichRecord(r, ctx)));
    enriched.push(...chunk.filter(Boolean));
  }
  return enriched;
}

// Tokens de estado tomados del tema (colors de ThemeContext). Válidos en claro y oscuro.
const tint = (hex) => hex + "1F";

export const statusTokens = (colors, estado) => {
    switch (estado) {
        case "presente":    return {color: colors.statusTextPresente, bg: colors.statusPresente, label: "attendance.present"};
        case "tarde":       return {color: colors.statusTextTarde, bg: colors.statusTarde, label: "attendance.late"};
        case "justificado": return {color: colors.info, bg: tint(colors.info), label: "attendance.justified"};
        default:            return {color: colors.danger, bg: tint(colors.danger), label: "attendance.absent"};
    }
};

export const approvalTokens = (colors, estado) => {
    switch (estado) {
        case "Approved": return {color: colors.success, label: "attendance.approved"};
        case "Rejected": return {color: colors.danger, label: "attendance.rejected"};
        default:         return {color: colors.warning, label: "attendance.pending"};
    }
};

const SUBJECT_KEYS = {
    math: "subjects.math",
    "Matemáticas": "subjects.math",
    physics: "subjects.physics",
    "Física": "subjects.physics",
    history: "subjects.history",
    Historia: "subjects.history",
    programming: "subjects.programming",
    Programación: "subjects.programming",
    science: "subjects.science",
    Ciencias: "subjects.science",
    spanish: "subjects.spanish",
    Español: "subjects.spanish",
    english: "subjects.english",
    Inglés: "subjects.english",
    physicalEducation: "subjects.physicalEducation",
    "Educación Física": "subjects.physicalEducation",
};

export function getSubjectLabel(subject, t) {
    const translationKey = SUBJECT_KEYS[subject];
    return translationKey ? t(translationKey, {defaultValue: subject}) : subject;
}

export function formatDateKey(date) {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function resolveLocale(language) {
    if (language === 'en') return 'en-US';
    if (language === 'pt') return 'pt-BR';
    if (language === 'fr') return 'fr-FR';
    return 'es-ES';
}

export function getDayLabel(dayOfWeek, locale = 'es-ES') {
    const day = Number(dayOfWeek);
    if (!day || day < 1 || day > 7) return '—';
    try {
        const ref = new Date(2024, 0, day);
        const label = ref.toLocaleDateString(locale, {weekday: 'long'});
        return label ? label.charAt(0).toUpperCase() + label.slice(1) : '—';
    } catch {
        return '—';
    }
}

export function formatDateDisplay(date, t, locale = 'es-ES') {
    if (!date) return t("attendance.filterByDate");
    return date.toLocaleDateString(locale, {day: "2-digit", month: "short", year: "numeric"});
}

export function useAttendanceViewModel() {
    const {t, i18n} = useTranslation();
    const {colors, loadThemeForRole, theme} = useTheme();
    const refreshKey = useLanguageRefresh();
    const updateKey = refreshKey;
    const isDark = theme === "dark";

    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchText, setSearchText] = useState("");
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [pickerTarget, setPickerTarget] = useState("from");
    const [statusFilter, setStatusFilter] = useState("");
    const [showPicker, setShowPicker] = useState(false);
    const [showIOSModal, setShowIOSModal] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());
    const [detailItem, setDetailItem] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [teacherData, setTeacherData] = useState([]);

    const fetchAttendance = useCallback(async (role) => {
        try {
            setLoading(true);
            setError(null);
            const locale = resolveLocale(i18n.language);
            const user = await getCurrentUser();
            const actors = user?.personId ? await ActorService.getByPerson(user.personId) : [];
            const myActor = actors?.length > 0 ? actors[0] : null;

            const roleLower = String(role || '').toLowerCase();
            const isTeacherRole = roleLower === 'docente' || roleLower === 'teacher' || roleLower === 'instructor';
            const isAdminRole = roleLower === 'administrador' || roleLower === 'admin';

            let records = [];

            if (isAdminRole) {
                const arData = await backendGet(ENV.ATTENDANCE_BASE_URL, 'api/v1/attendance-records');
                records = unwrap(arData);
            } else if (isTeacherRole && myActor) {
                // Backend: schedule-blocks filtra ?instructorActorId= (camelCase).
                const blockData = await backendGet(ENV.SCHEDULING_BASE_URL, 'api/v1/schedule-blocks', {instructorActorId: myActor.academicActorId});
                const blocks = unwrap(blockData);
                const blockIds = blocks.map(b => b.schedule_block_id);

                for (const blockId of blockIds) {
                    const sessionData = await backendGet(ENV.SCHEDULING_BASE_URL, 'api/v1/class-sessions', {scheduleBlockId: blockId});
                    const sessions = unwrap(sessionData);
                    for (const session of sessions) {
                        const arData = await backendGet(ENV.ATTENDANCE_BASE_URL, 'api/v1/attendance-records', {classSessionId: session.class_session_id});
                        records.push(...unwrap(arData));
                    }
                }
            } else if (myActor) {
                const arData = await backendGet(ENV.ATTENDANCE_BASE_URL, 'api/v1/attendance-records', {academicActorId: myActor.academicActorId});
                records = unwrap(arData);
            }

            let activePeriod = null;
            try {
                activePeriod = myActor?.schoolId
                    ? await PeriodService.getActiveBySchool(myActor.schoolId)
                    : (await PeriodService.getAll({is_active: true}))[0] || null;
            } catch (e) {}

            // El backend acota las justificaciones al alcance del usuario; si fallan, el histórico sigue sin ellas.
            const justifications = await safe(JustificationService.getAll()) ?? [];
            const justificationsByRecord = new Map(justifications.map((j) => [String(j.attendanceRecordId), j]));

            const enriched = await enrichRecords(records, { locale, t, activePeriod, justificationsByRecord });

            setTeacherData(enriched);
        } catch (error) {
            console.error('Error fetching attendance:', error);
            setError(t('attendance.loadError'));
        } finally {
            setLoading(false);
        }
    }, [t, i18n.language]);

    const retry = useCallback(async () => {
        try {
            const role = await getCurrentUserRole();
            setUserRole(role);
            if (role) await loadThemeForRole(role);
            await fetchAttendance(role);
        } catch (error) {
            console.error("Error cargando datos del usuario:", error);
            setError(t('attendance.loadError'));
            setLoading(false);
        }
    }, [fetchAttendance, loadThemeForRole, t]);

    useEffect(() => {
        const init = async () => {
            try {
                const role = await getCurrentUserRole();
                setUserRole(role);
                if (role) await loadThemeForRole(role);
                await fetchAttendance(role);
            } catch (error) {
                console.error("Error cargando datos del usuario:", error);
                setError(t('attendance.loadError'));
                setLoading(false);
            }
        };
        init();
    }, [fetchAttendance, loadThemeForRole]);

    const roleLower = String(userRole || '').toLowerCase();
    const isAdmin = roleLower === 'administrador' || roleLower === 'admin';
    // El instructor consulta a sus aprendices: mismo listado por persona que el admin (ERF 5.1).
    const isStaff = isAdmin || roleLower === 'instructor' || roleLower === 'docente' || roleLower === 'teacher';

    const activeData = filterAttendance(teacherData, {
        search: isStaff ? searchText : '',
        from: formatDateKey(fromDate),
        to: formatDateKey(toDate),
        status: statusFilter,
    });

    const openDetail = (item) => { setDetailItem(item); setShowDetailModal(true); };
    const closeDetail = () => { setShowDetailModal(false); setDetailItem(null); };

    const handleOpenPicker = (target) => {
        setPickerTarget(target);
        setTempDate((target === "to" ? toDate : fromDate) ?? new Date());
        Platform.OS === "ios" ? setShowIOSModal(true) : setShowPicker(true);
    };

    const handleAndroidChange = (event, date) => {
        setShowPicker(false);
        if (event.type === "set" && date) setPickedDate(date);
    };

    const setPickedDate = (date) => (pickerTarget === "to" ? setToDate(date) : setFromDate(date));

    return {
        t, locale: resolveLocale(i18n.language), isAdmin, isStaff, isDark, colors, refreshKey, updateKey,
        searchText, setSearchText, fromDate, setFromDate, toDate, setToDate, setPickedDate,
        statusFilter, setStatusFilter,
        showPicker, showIOSModal, setShowIOSModal, tempDate, setTempDate,
        activeData, detailItem, showDetailModal, loading, error, retry,
        openDetail, closeDetail, handleOpenPicker, handleAndroidChange,
    };
}
