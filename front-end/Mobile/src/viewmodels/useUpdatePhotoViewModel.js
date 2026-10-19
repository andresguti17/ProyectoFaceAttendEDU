import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../view/components/common/ThemeContext';
import {getCurrentUser, getCurrentUserRole} from "../services/UserService";
import {BiometricCaseService} from '../services/BiometricCaseService';
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {useCustomAlert} from '../view/components/common/useCustomAlert';

const MIN_REASON_LENGTH = 10;

// RN-29: cambiar el rostro registrado exige un caso aprobado. Aquí el usuario
// solicita la actualización, sigue su estado y, con el caso aprobado, pasa a
// registrar el rostro nuevo (RegisterFace en modo 'update'; el backend valida
// que la aprobación sea posterior al rostro vigente).
export function useUpdatePhotoViewModel() {
    const navigation = useNavigation();
    const {t} = useTranslation();
    const {loadThemeForRole} = useTheme();
    const {alertConfig, hideAlert, showSuccess, showError} = useCustomAlert();
    const updateKey = useLanguageRefresh();

    const [personId, setPersonId] = useState(null);
    const [latestCase, setLatestCase] = useState(null);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const role = await getCurrentUserRole();
            if (role) await loadThemeForRole(role);
            const user = await getCurrentUser();
            setPersonId(user?.personId || null);
            const cases = user?.personId ? await BiometricCaseService.getByPerson(user.personId) : [];
            setLatestCase(cases.find((c) => c?.isFacial) || null);
        } catch (error) {
            console.error('Error cargando solicitudes biométricas:', error);
            showError(t('common.error'), t('updatePhoto.loadError'));
        } finally {
            setLoading(false);
        }
    }, [loadThemeForRole, showError, t]);

    useEffect(() => {
        load();
    }, [load]);

    const status = latestCase?.updateStatus || null;
    const hasOpenRequest = status === 'Pending' || status === 'In_Review';
    const canRequest = !loading && !hasOpenRequest;
    const reasonValid = reason.trim().length >= MIN_REASON_LENGTH;

    const submitRequest = useCallback(async () => {
        if (!personId || !reasonValid || submitting) return;
        setSubmitting(true);
        try {
            const created = await BiometricCaseService.requestFacialUpdate(personId, reason.trim());
            setLatestCase(created);
            setReason('');
            showSuccess(t('updatePhoto.requestSentTitle'), t('updatePhoto.requestSentMsg'));
        } catch (error) {
            showError(t('common.error'), error?.message || t('updatePhoto.requestError'));
        } finally {
            setSubmitting(false);
        }
    }, [personId, reason, reasonValid, submitting, showSuccess, showError, t]);

    const goToFaceUpdate = useCallback(() => {
        navigation.navigate('RegisterFace', {mode: 'update'});
    }, [navigation]);

    const handleBack = useCallback(() => navigation.goBack(), [navigation]);

    return {
        updateKey, loading, submitting,
        latestCase, status, canRequest, canUpdateFace: status === 'Approved',
        reason, setReason, reasonValid, minReasonLength: MIN_REASON_LENGTH,
        submitRequest, goToFaceUpdate, reload: load, handleBack,
        alertConfig, hideAlert,
    };
}
