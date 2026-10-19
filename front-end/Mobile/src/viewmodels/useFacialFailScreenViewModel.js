import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../view/components/common/ThemeContext';
import {useNavigation} from '@react-navigation/native';
import {getCurrentUser, getCurrentUserRole} from "../services/UserService";
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {useCustomAlert} from '../view/components/common/useCustomAlert';
import {backendGet} from '../api/backend';
import ENV from '../config/env';
import {verifyQuestionnaireAnswers} from '../utils/identityVerification';

// Intentos de cuestionario antes de bloquear la actualización en esta visita.
const MAX_ATTEMPTS = 3;

// Flujo: 1) cuestionario con datos personales, verificado contra la persona
// registrada; 2) solo entonces se pasa a solicitar la actualización del rostro
// (UpdatePhoto): RN-29 exige un caso aprobado antes de re-registrarlo.
export function useFacialFailViewModel() {
    const navigation = useNavigation();
    const {t} = useTranslation();
    const {loadThemeForRole} = useTheme();
    const {alertConfig, hideAlert, showSuccess, showError, showWarning} = useCustomAlert();

    const [userRole, setUserRole] = useState(null);
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [showFacialUpdate, setShowFacialUpdate] = useState(false);
    const [verified, setVerified] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [verifying, setVerifying] = useState(false);
    const updateKey = useLanguageRefresh();

    // Inicialización: cargar rol y tema
    useEffect(() => {
        const init = async () => {
            try {
                const role = await getCurrentUserRole();
                setUserRole(role);
                if (role) await loadThemeForRole(role);
            } catch (error) {
                console.error('Error cargando rol:', error);
            }
        };
        init();
    }, [loadThemeForRole]);

    // Navegación
    const handleBack = useCallback(() => navigation.goBack(), [navigation]);
    const locked = attempts >= MAX_ATTEMPTS;

    const goToFaceUpdate = useCallback(() => {
        navigation.navigate('UpdatePhoto');
    }, [navigation]);

    // Paso 1: cuestionario
    const openQuestionnaire = useCallback(() => {
        if (locked) {
            showError(t('facialFail.lockedTitle'), t('facialFail.lockedMessage'));
            return;
        }
        if (verified) {
            goToFaceUpdate();
            return;
        }
        setShowQuestionnaire(true);
    }, [locked, verified, goToFaceUpdate, showError, t]);
    const closeQuestionnaire = useCallback(() => setShowQuestionnaire(false), []);

    const handleQuestionnaireSuccess = useCallback(async (data) => {
        setVerifying(true);
        try {
            const user = await getCurrentUser();
            if (!user?.personId) throw new Error(t('errors.missingPerson'));
            // backendGet normaliza a lista en snake_case (document_number, blood_type...).
            const [person] = await backendGet(ENV.API_BASE_URL, `api/v1/persons/${user.personId}`);

            if (!verifyQuestionnaireAnswers(person, data)) {
                const next = attempts + 1;
                setAttempts(next);
                showError(
                    t('facialFail.verifyFailedTitle'),
                    next >= MAX_ATTEMPTS
                        ? t('facialFail.lockedMessage')
                        : t('facialFail.verifyFailedMessage', {remaining: MAX_ATTEMPTS - next})
                );
                return;
            }
            setVerified(true);
            showSuccess(t('facialFail.success'), t('facialFail.verifiedMessage'), goToFaceUpdate);
        } catch (error) {
            console.error('Error verificando cuestionario:', error);
            showError(t('facialFail.verifyErrorTitle'), t('facialFail.verifyErrorMessage'));
        } finally {
            setVerifying(false);
        }
    }, [attempts, goToFaceUpdate, showError, showSuccess, t]);

    // Paso 2: actualización facial, solo tras verificar el cuestionario
    const openFacialUpdate = useCallback(() => {
        if (!verified) {
            showWarning(
                t('facialFail.questionnaireFirstTitle'),
                t('facialFail.questionnaireFirstMessage'),
                [{text: 'OK', onPress: hideAlert}]
            );
            return;
        }
        setShowFacialUpdate(true);
    }, [verified, showWarning, hideAlert, t]);
    const closeFacialUpdate = useCallback(() => setShowFacialUpdate(false), []);
    const handleFacialUpdateSuccess = useCallback(() => goToFaceUpdate(), [goToFaceUpdate]);

    return {
        userRole,
        updateKey,
        verified,
        verifying,
        showQuestionnaire,
        showFacialUpdate,
        handleBack,
        openQuestionnaire,
        closeQuestionnaire,
        openFacialUpdate,
        closeFacialUpdate,
        handleQuestionnaireSuccess,
        handleFacialUpdateSuccess,
        alertConfig,
        hideAlert,
    };
}
