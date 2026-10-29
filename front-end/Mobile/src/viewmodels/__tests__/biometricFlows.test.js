// Registro y actualización del rostro: prueba de vida, autorización (Ley 1581), RN-29 y el cuestionario.
import {useFaceLivenessCapture} from '../useFaceLivenessCapture';
import {useRegisterFaceScreenViewModel} from '../useRegisterFaceScreenViewModel';
import {useFacialFailViewModel} from '../useFacialFailScreenViewModel';
import {useUpdatePhotoViewModel} from '../useUpdatePhotoViewModel';
import {FaceAuthService} from '../../services/FaceAuthService';
import {ConsentService} from '../../services/consentService';
import {BiometricCaseService} from '../../services/BiometricCaseService';
import {getCurrentUser, getCurrentUserRole} from '../../services/UserService';
import {request} from '../../api/apiClient';
import {backendGet} from '../../api/backend';
import {renderHook, flush, act} from './support/renderHook';

jest.mock('react-i18next', () => {
    const translation = {t: (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k)};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}};
});
jest.mock('@react-navigation/native', () => {
    const {useEffect} = jest.requireActual('react');
    const mockNavigation = {goBack: jest.fn(), navigate: jest.fn()};
    const mockRoute = {params: {}};
    return {useFocusEffect: (cb) => useEffect(cb, [cb]), useNavigation: () => mockNavigation, useRoute: () => mockRoute, __navigation: mockNavigation, __route: mockRoute};
});
jest.mock('expo-camera', () => ({useCameraPermissions: () => [{granted: true}, jest.fn()]}));
jest.mock('../../view/components/common/ThemeContext', () => {
    const theme = {loadThemeForRole: jest.fn()};
    return {useTheme: () => theme};
});
jest.mock('../../utils/useLanguageRefresh', () => ({useLanguageRefresh: () => 0}));
const mockUser = {faceUpdateUnlocked: false, unlockFaceUpdate: jest.fn()};
jest.mock('../../utils/UserContext', () => ({useUser: () => mockUser}));
const mockAlerts = {alertConfig: {}, hideAlert: jest.fn(), showSuccess: jest.fn(), showError: jest.fn(), showWarning: jest.fn()};
jest.mock('../../view/components/common/useCustomAlert', () => ({useCustomAlert: () => mockAlerts}));
jest.mock('../../services/FaceAuthService', () => ({FaceAuthService: {getLivenessChallenge: jest.fn(), submitLivenessStep: jest.fn(), enrollFace: jest.fn()}}));
jest.mock('../../services/consentService', () => ({ConsentService: {get: jest.fn(), accept: jest.fn()}}));
jest.mock('../../services/BiometricCaseService', () => ({BiometricCaseService: {getByPerson: jest.fn(), requestFacialUpdate: jest.fn()}}));
jest.mock('../../services/UserService', () => ({getCurrentUser: jest.fn(), getCurrentUserRole: jest.fn()}));
jest.mock('../../api/apiClient', () => ({request: jest.fn(), GET: 'GET'}));
jest.mock('../../api/backend', () => ({backendGet: jest.fn()}));

const {__navigation: navigation, __route: route} = jest.requireMock('@react-navigation/native');

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    route.params = {};
    mockUser.faceUpdateUnlocked = false;
    getCurrentUser.mockResolvedValue({personId: 'p-1'});
});

describe('useFaceLivenessCapture', () => {
    let frame = 0;
    const camera = {
        takePictureAsync: jest.fn(async () => ({base64: `f${frame++}`})),
        getAvailablePictureSizesAsync: jest.fn(async () => ['1920x1080', '640x480', '320x240', 'bogus']),
    };

    beforeEach(() => {
        frame = 0;
        FaceAuthService.getLivenessChallenge.mockResolvedValue({challenge_token: 't0', actions: ['blink']});
        FaceAuthService.submitLivenessStep.mockResolvedValue({challenge_token: 't1'});
        FaceAuthService.enrollFace.mockResolvedValue({});
    });

    async function capture() {
        const hook = await renderHook(useFaceLivenessCapture);
        hook.result().cameraRef.current = camera;
        return hook.result;
    }

    test('the camera picks the largest picture size that fits 640 px', async () => {
        const vm = await capture();

        await act(async () => vm().handleCameraReady());

        expect(vm().cameraReady).toBe(true);
        expect(vm().pictureSize).toBe('640x480');
    });

    test('with only large sizes it picks the smallest', async () => {
        const vm = await capture();
        camera.getAvailablePictureSizesAsync.mockResolvedValueOnce(['1920x1080', '1280x720']);

        await act(async () => vm().handleCameraReady());

        expect(vm().pictureSize).toBe('1280x720');
    });

    test('a gesture rejected once is repeated and the face is enrolled with the signed token and the middle frame', async () => {
        FaceAuthService.submitLivenessStep.mockRejectedValueOnce(new Error('No se detectó parpadeo')).mockResolvedValueOnce({challenge_token: 't1'});
        const vm = await capture();

        let ok;
        await act(async () => {
            ok = await vm().registerFace('p-1');
        });

        expect(ok).toBe(true);
        expect(FaceAuthService.getLivenessChallenge).toHaveBeenCalledWith(1);
        expect(FaceAuthService.submitLivenessStep).toHaveBeenCalledTimes(2);
        expect(FaceAuthService.submitLivenessStep.mock.calls[1][0]).toMatchObject({challengeToken: 't0', actionIndex: 0});
        expect(FaceAuthService.submitLivenessStep.mock.calls[1][0].images).toHaveLength(6);
        // Fotogramas del segundo intento: f6..f11; el central es f9.
        expect(FaceAuthService.enrollFace).toHaveBeenCalledWith({personId: 'p-1', imageBase64: 'data:image/jpeg;base64,f9', challengeToken: 't1'});
        expect(vm().status).toEqual({message: 'faceCapture.registered', tone: 'ok'});
        expect(vm().busy).toBe(false);
        expect(vm().livenessProgress).toBeNull();
    }, 20000);

    test('a gesture that fails twice stops the enrollment with the backend message', async () => {
        FaceAuthService.submitLivenessStep.mockRejectedValue(new Error('Gesto no válido'));
        const vm = await capture();

        let ok;
        await act(async () => {
            ok = await vm().registerFace('p-1');
        });

        expect(ok).toBe(false);
        expect(FaceAuthService.enrollFace).not.toHaveBeenCalled();
        expect(vm().status).toEqual({message: 'Gesto no válido', tone: 'error'});
    }, 20000);

    test('replacing a face without an approved case explains the rule', async () => {
        FaceAuthService.enrollFace.mockRejectedValue(Object.assign(new Error('Forbidden'), {status: 403}));
        const vm = await capture();

        await act(async () => {
            await vm().registerFace('p-1');
        });

        expect(vm().status.message).toBe('faceCapture.replaceNotAllowed');
    }, 20000);

    test('without a person or a camera nothing is sent', async () => {
        const vm = await capture();
        await act(async () => {
            expect(await vm().registerFace(null)).toBe(false);
        });
        expect(vm().status.message).toBe('faceCapture.missingPerson');

        vm().cameraRef.current = null;
        await act(async () => {
            expect(await vm().registerFace('p-1')).toBe(false);
        });
        expect(vm().status.message).toBe('faceCapture.cameraNotReady');
        expect(FaceAuthService.enrollFace).not.toHaveBeenCalled();
    }, 20000);
});

describe('useRegisterFaceScreenViewModel', () => {
    async function screen(role = 'Aprendiz') {
        getCurrentUserRole.mockResolvedValue(role);
        const hook = await renderHook(useRegisterFaceScreenViewModel);
        await flush();
        await flush();
        return hook.result;
    }

    test('without biometric authorization the camera stays closed until the person authorizes', async () => {
        ConsentService.get.mockResolvedValue({biometricAuthorized: false});
        ConsentService.accept.mockResolvedValue({});
        request.mockResolvedValue({has_face: false});

        const vm = await screen();
        expect(vm().biometricAuthorized).toBe(false);

        await act(async () => vm().authorizeBiometrics());

        expect(ConsentService.accept).toHaveBeenCalledWith('p-1', {biometricAccepted: true});
        expect(vm().biometricAuthorized).toBe(true);
        expect(vm().title).toBe('registerFace.title');
    });

    test('a failed authorization is reported', async () => {
        ConsentService.get.mockRejectedValue(new Error('503'));
        ConsentService.accept.mockRejectedValue(new Error('No se pudo guardar'));
        request.mockResolvedValue({has_face: false});

        const vm = await screen();
        expect(vm().biometricAuthorized).toBe(false);
        await act(async () => vm().authorizeBiometrics());

        expect(mockAlerts.showError).toHaveBeenCalledWith('privacyConsent.title', 'No se pudo guardar');
    });

    test('a learner who already has a face is sent back', async () => {
        ConsentService.get.mockResolvedValue({biometricAuthorized: true});
        request.mockResolvedValue({has_face: true});

        await screen('Aprendiz');

        expect(request).toHaveBeenCalledWith({method: 'GET', url: 'api/v1/biometric/p-1/summary'});
        expect(mockAlerts.showError).toHaveBeenCalledTimes(1);
        expect(mockAlerts.showError.mock.calls[0][1]).toBe('faceCapture.alreadyRegistered');
    });

    test('if the biometric summary cannot be read the screen fails closed', async () => {
        ConsentService.get.mockResolvedValue({biometricAuthorized: true});
        request.mockRejectedValue(new Error('503'));

        await screen('Instructor');

        expect(mockAlerts.showError.mock.calls[0][1]).toBe('faceCapture.genericError');
    });

    test('an admin registering someone else skips the one-face check', async () => {
        route.params = {personId: 'p-9', personName: 'Eva', mode: 'register'};
        ConsentService.get.mockResolvedValue({biometricAuthorized: true});

        const vm = await screen('Administrador');

        expect(request).not.toHaveBeenCalled();
        expect(vm().personName).toBe('Eva');
        expect(vm().permissionGranted).toBe(true);
    });

    test('an update without passing the questionnaire is blocked', async () => {
        route.params = {mode: 'update'};
        ConsentService.get.mockResolvedValue({biometricAuthorized: true});

        const vm = await screen('Aprendiz');

        expect(vm().title).toBe('faceCapture.updateTitle');
        expect(mockAlerts.showError.mock.calls[0][1]).toBe('faceCapture.updateLocked');
    });
});

describe('useFacialFailViewModel', () => {
    const PERSON = {document_number: '123', name: 'Ana', last_name: 'Pérez', blood_type: 'O+', birth_date: '2000-12-31', phone: '3001234567', email: 'ana@x.co'};

    async function screen() {
        getCurrentUserRole.mockResolvedValue('Aprendiz');
        backendGet.mockResolvedValue([PERSON]);
        const hook = await renderHook(useFacialFailViewModel);
        await flush();
        return hook.result;
    }

    test('the face update stays closed until the questionnaire is verified', async () => {
        const vm = await screen();

        act(() => vm().openFacialUpdate());
        expect(mockAlerts.showWarning).toHaveBeenCalled();
        expect(vm().showFacialUpdate).toBe(false);

        act(() => vm().openQuestionnaire());
        expect(vm().showQuestionnaire).toBe(true);
    });

    test('wrong answers count attempts and lock after three', async () => {
        const vm = await screen();

        for (let i = 0; i < 3; i += 1) {
            await act(async () => vm().handleQuestionnaireSuccess({documentNumber: '999'}));
        }

        expect(mockAlerts.showError.mock.calls.map((c) => c[1])).toEqual([
            'facialFail.verifyFailedMessage:{"remaining":2}',
            'facialFail.verifyFailedMessage:{"remaining":1}',
            'facialFail.lockedMessage',
        ]);
        expect(mockUser.unlockFaceUpdate).not.toHaveBeenCalled();
        act(() => vm().openQuestionnaire());
        expect(mockAlerts.showError).toHaveBeenLastCalledWith('facialFail.lockedTitle', 'facialFail.lockedMessage');
    });

    test('a failure reading the person is reported, not counted', async () => {
        const vm = await screen();
        backendGet.mockRejectedValue(new Error('503'));

        await act(async () => vm().handleQuestionnaireSuccess({documentNumber: '123'}));

        expect(mockAlerts.showError).toHaveBeenCalledWith('facialFail.verifyErrorTitle', 'facialFail.verifyErrorMessage');
        expect(vm().verifying).toBe(false);
    });

    test('once unlocked the update opens and leads to UpdatePhoto', async () => {
        mockUser.faceUpdateUnlocked = true;
        const vm = await screen();

        act(() => vm().openFacialUpdate());
        expect(vm().showFacialUpdate).toBe(true);
        act(() => vm().handleFacialUpdateSuccess());
        expect(navigation.navigate).toHaveBeenCalledWith('UpdatePhoto');
    });
});

describe('useUpdatePhotoViewModel', () => {
    async function screen() {
        getCurrentUserRole.mockResolvedValue('Aprendiz');
        const hook = await renderHook(useUpdatePhotoViewModel);
        await flush();
        return hook.result;
    }

    test('without the questionnaire the screen sends the user back', async () => {
        BiometricCaseService.getByPerson.mockResolvedValue([]);

        await screen();

        expect(mockAlerts.showError).toHaveBeenCalledWith('faceCapture.blockedTitle', 'faceCapture.updateLocked', expect.any(Function));
    });

    test('an open request blocks a new one and an approved one enables the update', async () => {
        mockUser.faceUpdateUnlocked = true;
        BiometricCaseService.getByPerson.mockResolvedValue([{isFacial: false, updateStatus: 'Approved'}, {isFacial: true, updateStatus: 'Pending'}]);

        const vm = await screen();
        expect(vm()).toMatchObject({status: 'Pending', canRequest: false, canUpdateFace: false});

        BiometricCaseService.getByPerson.mockResolvedValue([{isFacial: true, updateStatus: 'Approved'}]);
        await act(async () => vm().reload());
        expect(vm().canUpdateFace).toBe(true);
        act(() => vm().goToFaceUpdate());
        expect(navigation.navigate).toHaveBeenCalledWith('RegisterFace', {mode: 'update'});
    });

    test('a request needs a reason of at least ten characters', async () => {
        mockUser.faceUpdateUnlocked = true;
        BiometricCaseService.getByPerson.mockResolvedValue([]);
        BiometricCaseService.requestFacialUpdate.mockResolvedValue({isFacial: true, updateStatus: 'Pending'});
        const vm = await screen();

        act(() => vm().setReason('corto'));
        await act(async () => vm().submitRequest());
        expect(BiometricCaseService.requestFacialUpdate).not.toHaveBeenCalled();

        act(() => vm().setReason('  Me operé la cara  '));
        await act(async () => vm().submitRequest());
        expect(BiometricCaseService.requestFacialUpdate).toHaveBeenCalledWith('p-1', 'Me operé la cara');
        expect(vm()).toMatchObject({status: 'Pending', reason: ''});
        expect(mockAlerts.showSuccess).toHaveBeenCalled();
    });

    test('load and request failures are shown', async () => {
        mockUser.faceUpdateUnlocked = true;
        BiometricCaseService.getByPerson.mockRejectedValue(new Error('503'));
        const vm = await screen();
        expect(mockAlerts.showError).toHaveBeenCalledWith('common.error', 'updatePhoto.loadError');

        BiometricCaseService.requestFacialUpdate.mockRejectedValue(new Error('Caso duplicado'));
        act(() => vm().setReason('Un motivo suficiente'));
        await act(async () => vm().submitRequest());
        expect(mockAlerts.showError).toHaveBeenLastCalledWith('common.error', 'Caso duplicado');
    });
});
