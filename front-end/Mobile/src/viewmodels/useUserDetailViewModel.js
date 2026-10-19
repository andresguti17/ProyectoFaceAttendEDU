import {useCallback, useState} from 'react';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import {PersonService} from '../services/PersonService';
import {FaceAuthService} from '../services/FaceAuthService';
import {ActorService} from '../services/ActorService';
import {AttendanceService} from '../services/AttendanceService';
import {EnrollmentService} from '../services/EnrollmentService';
import {CohortService} from '../services/CohortService';
import {ProgramService} from '../services/ProgramService';

// Mismo umbral que la web (ATTENDANCE_THRESHOLDS.MIN_ACCEPTABLE).
export const MIN_ATTENDANCE = 80;

// Cada bloque se consulta por separado: si un microservicio falla, el resto
// del detalle se sigue mostrando en lugar de dejar la pantalla vacía.
const safe = async (fn, fallback = null) => {
    try {
        return await fn();
    } catch {
        return fallback;
    }
};

async function loadAttendance(actorIds) {
    if (!actorIds.length) return null;
    const byActor = await AttendanceService.getSummary(actorIds);
    const totals = {present: 0, late: 0, absent: 0, justified: 0, total: 0};
    byActor.forEach((counts) => {
        Object.keys(totals).forEach((k) => {
            totals[k] += Number(counts?.[k]) || 0;
        });
    });
    const attended = totals.present + totals.late + totals.justified;
    return {...totals, rate: totals.total ? Math.round((attended / totals.total) * 100) : null};
}

async function loadProgram(actorIds) {
    for (const actorId of actorIds) {
        const [enrollment] = await EnrollmentService.getActiveByActor(actorId);
        if (!enrollment?.cohortId) continue;
        const cohort = await CohortService.getById(enrollment.cohortId);
        const program = cohort?.programId ? await safe(() => ProgramService.getById(cohort.programId)) : null;
        return {program: program?.name || null, cohort: cohort?.code || null};
    }
    return null;
}

export function useUserDetailViewModel() {
    const navigation = useNavigation();
    const {params = {}} = useRoute();
    const user = params.user || {};
    const personId = user.personId || null;

    const [loading, setLoading] = useState(true);
    const [person, setPerson] = useState(null);
    const [biometrics, setBiometrics] = useState(null);
    const [attendance, setAttendance] = useState(null);
    const [academic, setAcademic] = useState(null);

    const load = useCallback(async () => {
        if (!personId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const actors = await safe(() => ActorService.getByPerson(personId), []);
        const actorIds = actors.map((a) => a.academicActorId).filter(Boolean);
        const [p, bio, att, acad] = await Promise.all([
            safe(() => PersonService.getById(personId)),
            safe(() => FaceAuthService.summary(personId)),
            safe(() => loadAttendance(actorIds)),
            safe(() => loadProgram(actorIds)),
        ]);
        setPerson(p);
        setBiometrics(bio ? {hasFace: !!bio.has_face, hasFingerprint: !!bio.has_fingerprint} : null);
        setAttendance(att);
        setAcademic(acad);
        setLoading(false);
    }, [personId]);

    // Se recarga al volver del registro facial para reflejar el nuevo estado.
    useFocusEffect(useCallback(() => {
        load();
    }, [load]));

    const name = person?.fullName || user.nombre || user.username || '—';

    const openFaceRegistration = useCallback(() => {
        navigation.navigate('RegisterFace', {
            personId,
            personName: name,
            mode: biometrics?.hasFace ? 'update' : 'register',
        });
    }, [navigation, personId, name, biometrics]);

    return {
        loading,
        name,
        username: user.username || '',
        active: user.status !== false,
        roleNames: user.roleNames || [],
        email: person?.email || user.email || '',
        phone: person?.phone || user.telefono || '',
        documentNumber: person?.documentNumber || user.documentNumber || '',
        program: academic?.program || null,
        cohort: academic?.cohort || null,
        attendance,
        biometrics,
        canRegisterFace: !!personId,
        openFaceRegistration,
        refresh: load,
        handleBack: () => navigation.goBack(),
    };
}
