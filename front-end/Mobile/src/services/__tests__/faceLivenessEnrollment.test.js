jest.mock('../FaceAuthService', () => ({
    FaceAuthService: {
        getLivenessChallenge: jest.fn(),
        submitLivenessStep: jest.fn(),
        enrollFace: jest.fn(),
    },
}));

import {FaceAuthService} from '../FaceAuthService';
import {enrollFaceWithLiveness, FRAMES_PER_GESTURE, GESTURE_ATTEMPTS} from '../faceLivenessEnrollment';

function frameCapturer() {
    let n = 0;
    return jest.fn(async () => `frame-${n++}`);
}

beforeEach(() => {
    jest.clearAllMocks();
});

test('captures FRAMES_PER_GESTURE frames per gesture, chains the challenge token, and enrolls with the middle frame', async () => {
    FaceAuthService.getLivenessChallenge.mockResolvedValue({
        challenge_token: 'token-0',
        actions: ['blink', 'turn'],
    });
    FaceAuthService.submitLivenessStep
        .mockResolvedValueOnce({challenge_token: 'token-1'})
        .mockResolvedValueOnce({challenge_token: 'token-2'});
    FaceAuthService.enrollFace.mockResolvedValue({embedding_id: 'e1'});

    const captureFrame = frameCapturer();
    const onGestureStart = jest.fn();

    const result = await enrollFaceWithLiveness({
        personId: 'person-a',
        captureFrame,
        translateActionLabel: (action) => action,
        onGestureStart,
    });

    expect(captureFrame).toHaveBeenCalledTimes(FRAMES_PER_GESTURE * 2);
    expect(FaceAuthService.submitLivenessStep).toHaveBeenNthCalledWith(1, {
        challengeToken: 'token-0',
        actionIndex: 0,
        images: ['frame-0', 'frame-1', 'frame-2', 'frame-3', 'frame-4', 'frame-5'],
    });
    expect(FaceAuthService.submitLivenessStep).toHaveBeenNthCalledWith(2, {
        challengeToken: 'token-1',
        actionIndex: 1,
        images: ['frame-6', 'frame-7', 'frame-8', 'frame-9', 'frame-10', 'frame-11'],
    });
    // 12 fotogramas en total (2 gestos x 6): el del medio es el índice 6.
    expect(FaceAuthService.enrollFace).toHaveBeenCalledWith({
        personId: 'person-a',
        imageBase64: 'frame-6',
        challengeToken: 'token-2',
    });
    expect(result).toEqual({embedding_id: 'e1'});
});

test('retries the same gesture once if the server rejects it, then succeeds without re-trying later gestures', async () => {
    FaceAuthService.getLivenessChallenge.mockResolvedValue({
        challenge_token: 'token-0',
        actions: ['blink'],
    });
    FaceAuthService.submitLivenessStep
        .mockRejectedValueOnce(new Error('Liveness gesture not detected'))
        .mockResolvedValueOnce({challenge_token: 'token-1'});
    FaceAuthService.enrollFace.mockResolvedValue({embedding_id: 'e1'});

    const onGestureRetry = jest.fn();

    await enrollFaceWithLiveness({
        personId: 'person-a',
        captureFrame: frameCapturer(),
        translateActionLabel: (action) => action,
        onGestureRetry,
    });

    expect(FaceAuthService.submitLivenessStep).toHaveBeenCalledTimes(2);
    expect(onGestureRetry).toHaveBeenCalledWith('Liveness gesture not detected');
    expect(FaceAuthService.enrollFace).toHaveBeenCalledTimes(1);
});

test(`gives up after ${GESTURE_ATTEMPTS} failed attempts on the same gesture and never enrolls`, async () => {
    FaceAuthService.getLivenessChallenge.mockResolvedValue({
        challenge_token: 'token-0',
        actions: ['blink'],
    });
    FaceAuthService.submitLivenessStep.mockRejectedValue(new Error('Liveness gesture not detected'));

    await expect(
        enrollFaceWithLiveness({
            personId: 'person-a',
            captureFrame: frameCapturer(),
            translateActionLabel: (action) => action,
        })
    ).rejects.toThrow('Liveness gesture not detected');

    expect(FaceAuthService.submitLivenessStep).toHaveBeenCalledTimes(GESTURE_ATTEMPTS);
    expect(FaceAuthService.enrollFace).not.toHaveBeenCalled();
});
