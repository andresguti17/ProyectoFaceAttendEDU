import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {BiometricCaseService} from '../services/BiometricCaseService';
import {getPersonCached} from '../services/JustificationService';
import {getCurrentUser} from '../services/UserService';
import {useCustomAlert} from '../view/components/common/useCustomAlert';

// Revisión de solicitudes de actualización facial (RN-29, biometric.case:review).
export function useBiometricCasesViewModel() {
    const navigation = useNavigation();
    const {t} = useTranslation();
    const {alertConfig, hideAlert, showError, showConfirm} = useCustomAlert();

    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const open = (await BiometricCaseService.getAll())
                .filter((c) => c && (c.isPending || c.isInReview));
            const withNames = await Promise.all(open.map(async (c) => {
                const person = await getPersonCached(c.personId);
                return {...c, personName: `${person?.name || ''} ${person?.last_name || ''}`.trim() || c.personId};
            }));
            setCases(withNames);
        } catch (error) {
            showError(t('common.error'), error?.message || t('biometricCases.loadError'));
        } finally {
            setLoading(false);
        }
    }, [showError, t]);

    useEffect(() => {
        load();
    }, [load]);

    const decide = useCallback((item, updateStatus) => {
        const question = updateStatus === 'Approved' ? t('biometricCases.confirmApprove') : t('biometricCases.confirmReject');
        showConfirm(t('biometricCases.title'), question, async () => {
            setBusyId(item.caseId);
            try {
                const reviewer = await getCurrentUser();
                await BiometricCaseService.review(item.caseId, {updateStatus, reviewedBy: reviewer?.userId});
                setCases((prev) => prev.filter((c) => c.caseId !== item.caseId));
            } catch (error) {
                showError(t('common.error'), error?.message || t('biometricCases.reviewError'));
            } finally {
                setBusyId(null);
            }
        });
    }, [showConfirm, showError, t]);

    return {
        cases, loading, busyId, reload: load,
        approve: (item) => decide(item, 'Approved'),
        reject: (item) => decide(item, 'Rejected'),
        handleBack: () => navigation.goBack(),
        alertConfig, hideAlert,
    };
}
