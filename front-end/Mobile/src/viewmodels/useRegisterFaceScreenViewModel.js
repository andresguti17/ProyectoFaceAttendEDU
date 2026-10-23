import {useCallback, useEffect, useRef, useState} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useCameraPermissions} from 'expo-camera';
import {useCustomAlert} from '../view/components/common/useCustomAlert';
import {getCurrentUser, getCurrentUserRole} from '../services/UserService';
import {GET, request} from '../api/apiClient';
import {useUser} from '../utils/UserContext';
import {faceAccessDenial, REGISTER_EXEMPT_ROLES} from '../utils/faceAccess';
import {REGISTER_GESTURES, useFaceLivenessCapture} from './useFaceLivenessCapture';

// Registro/actualización facial contra ms-biometric, igual que el FaceModule
// web: prueba de vida de 3 gestos y POST /facial/enroll-image por person_id.
// Params opcionales: { personId, personName, mode: 'register' | 'update' }.
// Sin personId se registra el rostro del usuario autenticado.
export function useRegisterFaceScreenViewModel() {
    const navigation = useNavigation();
    const route = useRoute();
    const {t} = useTranslation();
    const {alertConfig, hideAlert, showSuccess, showError} = useCustomAlert();
    const {faceUpdateUnlocked} = useUser();
    const [role, setRole] = useState(null);
    const denied = useRef(false);
    const [permission, requestPermission] = useCameraPermissions();

    const params = route.params || {};
    const isUpdate = params.mode === 'update';
    const [personId, setPersonId] = useState(params.personId || null);

    const capture = useFaceLivenessCapture();
    const {registerFace, status, setStatus} = capture;

    useEffect(() => {
        if (params.personId) return;
        let active = true;
        getCurrentUser().then((user) => {
            if (active) setPersonId(user?.personId || null);
        });
        return () => {
            active = false;
        };
    }, [params.personId]);

    useEffect(() => {
        getCurrentUserRole().then(setRole);
    }, []);

    // Una sola denegación por visita: evita alertas duplicadas al re-ejecutarse los efectos.
    const denyAccess = useCallback((message) => {
        if (denied.current) return;
        denied.current = true;
        showError(t('faceCapture.blockedTitle'), message, () => navigation.goBack());
    }, [navigation, showError, t]);

    useEffect(() => {
        if (isUpdate) {
            const denial = faceAccessDenial({isUpdate: true, unlocked: faceUpdateUnlocked});
            if (denial) denyAccess(t(`faceCapture.${denial}`));
            return undefined;
        }
        if (!role || !personId || REGISTER_EXEMPT_ROLES.includes(role)) return undefined;
        let active = true;
        // Si no se puede comprobar, se deniega (falla cerrado).
        request({method: GET, url: `api/v1/biometric/${personId}/summary`})
            .then((summary) => {
                const denial = faceAccessDenial({role, hasFace: summary?.has_face});
                if (active && denial) denyAccess(t(`faceCapture.${denial}`));
            })
            .catch(() => {
                if (active) denyAccess(t('faceCapture.genericError'));
            });
        return () => {
            active = false;
        };
    }, [isUpdate, faceUpdateUnlocked, role, personId, denyAccess, t]);

    const handleCameraReady = useCallback(async () => {
        await capture.handleCameraReady();
        setStatus(t('faceCapture.cameraReady'));
    }, [capture.handleCameraReady, setStatus, t]);

    const handleMountError = useCallback((event) => {
        console.error('Error montando cámara:', event?.message);
        showError(t('registerFace.cameraErrorTitle'), t('registerFace.cameraErrorMsg'));
    }, [showError, t]);

    const handleBack = useCallback(() => {
        if (!capture.busy) navigation.goBack();
    }, [capture.busy, navigation]);

    const handleRegister = useCallback(async () => {
        const ok = await registerFace(personId);
        if (ok) {
            showSuccess(t('registerFace.saveSuccessTitle'), t('faceCapture.registered'), () => navigation.goBack());
        }
    }, [registerFace, personId, showSuccess, t, navigation]);

    const subtitle = status.message
        || (capture.cameraReady ? t('registerFace.subtitleReady') : t('registerFace.subtitleStarting'));

    return {
        ...capture,
        title: isUpdate ? t('faceCapture.updateTitle') : t('registerFace.title'),
        actionLabel: t(isUpdate ? 'faceCapture.updateButton' : 'faceCapture.registerButton', {count: REGISTER_GESTURES}),
        personName: params.personName || null,
        subtitle,
        permissionLoading: !permission,
        permissionGranted: !!permission?.granted,
        requestPermission,
        handleCameraReady,
        handleMountError,
        handleRegister,
        handleBack,
        alertConfig,
        hideAlert,
    };
}
