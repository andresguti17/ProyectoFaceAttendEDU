import {useCallback, useEffect, useState} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useCameraPermissions} from 'expo-camera';
import {useCustomAlert} from '../view/components/common/useCustomAlert';
import {getCurrentUser} from '../services/UserService';
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
