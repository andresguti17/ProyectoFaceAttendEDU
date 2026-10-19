import {useCallback, useEffect, useMemo, useState} from 'react';
import {Share} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useCustomAlert} from '../view/components/common/useCustomAlert';
import {request, GET} from '../api/apiClient';
import {backendGet} from '../api/backend';
import ENV from '../config/env';
import {getCurrentUserRole} from '../services/UserService';

const SUMMARY_MAX_IDS = 300; // tope de /attendance-records/summary
const REPORT_MAX_IDS = 1000; // tope de /attendance-reports

// CSV oficial de 05-attendance (ERF 7.1). null si no se puede obtener: el reporte
// se comparte igual con el resumen ya cargado.
// shortcut: con más de REPORT_MAX_IDS personas se comparte sin CSV; paginar si llega a pasar.
async function fetchReportCsv(people) {
    const ids = people.map((p) => p.id).filter((id) => id != null);
    if (ids.length === 0 || ids.length > REPORT_MAX_IDS) return null;
    const query = ids.map((id) => `academicActorIds=${encodeURIComponent(id)}`).join('&');
    try {
        return await request({
            method: GET,
            url: `${ENV.ATTENDANCE_BASE_URL}api/v1/attendance-reports?${query}&format=csv`,
            requiresAuth: true,
            responseType: 'text',
        });
    } catch {
        return null;
    }
}

export function useAttendanceReportViewModel() {
    const {t} = useTranslation();
    const ABSENCE_LIMIT = 3;
    const LATENESS_LIMIT = 6;

    const getAlertLevel = useCallback((person) => {
        if (person.absences > ABSENCE_LIMIT) return 'critical';
        if (person.lateness > LATENESS_LIMIT) return 'warning';
        return 'ok';
    }, [ABSENCE_LIMIT, LATENESS_LIMIT]);

    const {alertConfig, hideAlert, showSuccess, showError, showConfirm} = useCustomAlert();
    const [activeRole, setActiveRole] = useState('student');
    const [activeType, setActiveType] = useState('absence');
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchText, setSearchText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [students, setStudents] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [canSeeTeachers, setCanSeeTeachers] = useState(false);

    const fetchData = useCallback(async () => {
            try {
                setIsLoading(true);
                setError(null);
                // Conteos agregados en SQL vía /summary: descargar la tabla
                // entera y enriquecer actor por actor no terminaba nunca en el
                // dispositivo con volumen real.
                // El administrador ve toda la institución (aprendices e
                // instructores); el instructor, solo los aprendices que /summary
                // le devuelve (05-attendance acota por sus fichas).
                const isAdmin = (await getCurrentUserRole()) === 'Administrador';
                setCanSeeTeachers(isAdmin);
                const actorsRaw = (await backendGet(ENV.ACADEMIC_BASE_URL, 'api/v1/academic-actors', { limit: 2000 }, { useCache: true })) ?? [];
                let actors = (Array.isArray(actorsRaw) ? actorsRaw : [])
                    .filter((a) => a.academic_actor_id != null)
                    .filter((a) => isAdmin || a.actor_type_id === 1);
                const ids = actors.map((a) => a.academic_actor_id);
                const summary = {};
                for (let i = 0; i < ids.length; i += SUMMARY_MAX_IDS) {
                    const query = ids.slice(i, i + SUMMARY_MAX_IDS).map((id) => `academicActorIds=${encodeURIComponent(id)}`).join('&');
                    try {
                        Object.assign(summary, await request({
                            method: GET,
                            url: `${ENV.ATTENDANCE_BASE_URL}api/v1/attendance-records/summary?${query}`,
                            requiresAuth: true,
                        }));
                    } catch {}
                }

                if (!isAdmin) actors = actors.filter((a) => summary[String(a.academic_actor_id)]);

                const perActor = actors.map((actor) => {
                    const s = (summary && summary[String(actor.academic_actor_id)]) || {};
                    return {
                        id: actor.academic_actor_id,
                        absences: s.absent ?? 0,
                        lateness: s.late ?? 0,
                        name: '',
                        code: actor.actor_code || '—',
                        course: '—',
                        type: actor.actor_type_id === 1 ? 'student' : 'teacher',
                        personId: actor.person_id ?? null,
                    };
                });

                // Personas solo para quienes superan umbrales (lo único que se
                // lista); el resto conserva el conteo para el resumen.
                const flagged = perActor.filter((p) => p.absences > ABSENCE_LIMIT || p.lateness > LATENESS_LIMIT);
                const ENRICH_CHUNK_SIZE = 10;
                for (let i = 0; i < flagged.length; i += ENRICH_CHUNK_SIZE) {
                    await Promise.all(flagged.slice(i, i + ENRICH_CHUNK_SIZE).map(async (p) => {
                        if (!p.personId) return;
                        try {
                            const personData = await backendGet(ENV.API_BASE_URL, `api/v1/persons/${p.personId}`);
                            const person = (personData?.value || personData || [])[0] || {};
                            const full = `${person.name || ''} ${person.last_name || ''}`.trim();
                            if (full) p.name = full;
                        } catch {}
                    }));
                }

                const withNames = perActor.map((p) => ({
                    ...p,
                    name: p.name || t('attendance.unknownPerson', {id: p.id}),
                }));

                setStudents(withNames.filter(e => e.type === 'student'));
                setTeachers(withNames.filter(e => e.type === 'teacher'));
            } catch (error) {
                console.error('Error fetching report data:', error);
                setError(t('attendance.loadError'));
            } finally {
                setIsLoading(false);
            }
    }, [t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const rawData = activeRole === 'student' ? students : teachers;

    const filteredData = useMemo(() => {
        let data = rawData.filter(p => {
            if (activeType === 'absence' && p.absences <= ABSENCE_LIMIT) return false;
            if (activeType === 'lateness' && p.lateness <= LATENESS_LIMIT) return false;
            const level = getAlertLevel(p);
            if (activeFilter === 'critical' && level !== 'critical') return false;
            if (activeFilter === 'warning' && level !== 'warning') return false;
            return true;
        });
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            data = data.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.code.toLowerCase().includes(q) ||
                p.course.toLowerCase().includes(q),
            );
        }
        return data;
    }, [rawData, activeType, activeFilter, searchText, getAlertLevel, ABSENCE_LIMIT, LATENESS_LIMIT]);

    const summary = useMemo(() => {
        const over = rawData.filter(p =>
            activeType === 'absence' ? p.absences > ABSENCE_LIMIT : p.lateness > LATENESS_LIMIT,
        );
        return {
            critical: over.filter(p => getAlertLevel(p) === 'critical').length,
            warning: over.filter(p => getAlertLevel(p) === 'warning').length,
            ok: rawData.length - over.length,
        };
    }, [rawData, activeType, getAlertLevel, ABSENCE_LIMIT, LATENESS_LIMIT]);

    const handleGenerateIndividual = useCallback((person) => { setSelectedPerson(person); setModalVisible(true); }, []);
    const closeModal = useCallback(() => { setModalVisible(false); }, []);

    // El reporte se comparte por la hoja nativa (correo, mensajería): un resumen
    // legible con los datos cargados y, debajo, el CSV oficial de /attendance-reports.
    const sendReport = useCallback(async (people) => {
        const lines = people.map((p) => `${p.name} (${p.code}): ${t('attendanceReport.absenceShort', {count: p.absences})}, ${t('attendanceReport.latenessShort', {count: p.lateness})}`);
        const csv = await fetchReportCsv(people);
        const message = [t('attendanceReport.title'), ...lines, ...(csv ? ['', csv] : [])].join('\n');
        const result = await Share.share({title: t('attendanceReport.title'), message});
        if (result?.action === Share.sharedAction) showSuccess(t('attendanceReport.title'), t('attendanceReport.reportSent'));
    }, [showSuccess, t]);

    const handleConfirmReport = useCallback(async () => {
        setModalVisible(false);
        try {
            await sendReport(selectedPerson ? [selectedPerson] : []);
        } catch (error) {
            showError(t('common.error'), error.message || t('attendanceReport.reportError'));
        }
    }, [sendReport, selectedPerson, showError, t]);

    const handleGenerateAll = useCallback(() => {
        if (filteredData.length === 0) return;
        showConfirm(
            t('attendanceReport.title'),
            t('attendanceReport.confirmGeneral', {count: filteredData.length}),
            () => sendReport(filteredData).catch((error) => showError(t('common.error'), error.message || t('attendanceReport.reportError'))),
        );
    }, [filteredData, sendReport, showConfirm, showError, t]);

    const handleRoleChange = useCallback((role) => { setActiveRole(role); setSearchText(''); setActiveFilter('all'); }, []);

    return {
        ABSENCE_LIMIT, LATENESS_LIMIT, alertConfig, hideAlert,
        activeRole, canSeeTeachers, activeType, setActiveType, activeFilter, setActiveFilter,
        searchText, setSearchText, isLoading, error, retry: fetchData, selectedPerson, modalVisible,
        closeModal, summary, filteredData,
        handleGenerateIndividual, handleConfirmReport, handleGenerateAll, handleRoleChange,
    };
}
