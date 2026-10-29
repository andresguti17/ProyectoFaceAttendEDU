import {useCountdown} from '../useCountdown';
import {useCodeVerification} from '../useCodeVerification';
import {usePasswordUpdate} from '../usePasswordUpdate';
import {VerificationService, VerificationError} from '../../services/verificationService';
import {PasswordService} from '../../services/passwordService';
import {ApiError} from '../../api/apiClient';
import {MAX_CODE_ATTEMPTS, VerificationErrorType, PasswordUpdateErrorType} from '../../services/constants/auths';
import {renderHook, act} from '../../viewmodels/__tests__/support/renderHook';

jest.mock('react-i18next', () => {
    const translation = {t: (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k)};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}};
});
jest.mock('../../services/verificationService', () => {
    class VerificationError extends Error {
        constructor(type, message) {
            super(message);
            this.type = type;
        }
    }
    return {VerificationError, VerificationService: {verifyRecoveryCode: jest.fn()}};
});
jest.mock('../../services/passwordService', () => ({PasswordService: {updatePassword: jest.fn()}}));
jest.mock('../../storage/TokenStorage', () => ({getToken: jest.fn(), getSession: jest.fn(), saveToken: jest.fn()}));

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('useCountdown', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('counts down from the initial seconds and stops at zero', async () => {
        const {result} = await renderHook(useCountdown, 2);
        expect(result()).toMatchObject({remaining: 2, isActive: true});

        act(() => jest.advanceTimersByTime(1000));
        expect(result().remaining).toBe(1);
        act(() => jest.advanceTimersByTime(5000));
        expect(result()).toMatchObject({remaining: 0, isActive: false});
    });

    test('start restarts the timer and reset stops it', async () => {
        const {result} = await renderHook(useCountdown, 0);
        expect(result().isActive).toBe(false);

        act(() => result().start(3));
        act(() => jest.advanceTimersByTime(1000));
        expect(result().remaining).toBe(2);
        act(() => result().start(5));
        expect(result().remaining).toBe(5);

        act(() => result().reset());
        act(() => jest.advanceTimersByTime(3000));
        expect(result().remaining).toBe(0);
    });
});

describe('useCodeVerification', () => {
    async function withCode(code, onSuccess = jest.fn()) {
        const hook = await renderHook(useCodeVerification, {email: 'a@x.co', onSuccess});
        act(() => hook.result().setCode(code));
        return {...hook, onSuccess};
    }

    test('only a complete six digit code can be submitted', async () => {
        const {result} = await withCode('12 34');
        expect(result().canSubmit).toBe(false);

        await act(async () => {
            await result().verifyCode();
        });
        expect(VerificationService.verifyRecoveryCode).not.toHaveBeenCalled();
    });

    test('a valid code is sent trimmed and upper-cased and continues the flow', async () => {
        VerificationService.verifyRecoveryCode.mockResolvedValue(undefined);
        const {result, onSuccess} = await withCode('ab 12 cd');

        await act(async () => {
            await result().verifyCode();
        });

        expect(VerificationService.verifyRecoveryCode).toHaveBeenCalledWith('a@x.co', 'AB12CD');
        expect(onSuccess).toHaveBeenCalled();
        expect(result().error).toBeNull();
    });

    test('a 400/401 from identity counts as a wrong code and locks out after the limit', async () => {
        VerificationService.verifyRecoveryCode.mockRejectedValue(new ApiError(401, 'Unauthorized', null));
        const {result} = await withCode('123456');

        for (let i = 1; i < MAX_CODE_ATTEMPTS; i += 1) {
            await act(async () => {
                await result().verifyCode();
            });
            expect(result().error.type).toBe(VerificationErrorType.INVALID_CODE);
            expect(result().attempts).toBe(i);
        }
        await act(async () => {
            await result().verifyCode();
        });

        expect(result().isLockedOut).toBe(true);
        expect(result().canSubmit).toBe(false);
        expect(result().error.message).toContain('verifyCode.errorLocked');

        act(() => result().resetAttempts());
        expect(result()).toMatchObject({attempts: 0, isLockedOut: false, code: '', error: null});
    });

    test('other errors are shown as they come and do not count as wrong codes', async () => {
        VerificationService.verifyRecoveryCode.mockRejectedValueOnce(new VerificationError(VerificationErrorType.EXPIRED ?? 'EXPIRED', 'Código vencido'));
        const {result} = await withCode('123456');

        await act(async () => {
            await result().verifyCode();
        });
        expect(result().error.message).toBe('Código vencido');

        VerificationService.verifyRecoveryCode.mockRejectedValueOnce(new Error('Network request failed'));
        await act(async () => {
            await result().verifyCode();
        });
        expect(result().error).toEqual({type: VerificationErrorType.GENERIC, message: 'Network request failed'});

        act(() => result().clearError());
        expect(result().error).toBeNull();
    });
});

describe('usePasswordUpdate', () => {
    async function form(password, confirm = password) {
        const onSuccess = jest.fn();
        const hook = await renderHook(usePasswordUpdate, {email: 'a@x.co', onSuccess});
        act(() => {
            hook.result().setNewPassword(password);
            hook.result().setConfirmPassword(confirm);
        });
        return {...hook, onSuccess};
    }

    test('a weak or mismatched password cannot be submitted', async () => {
        const weak = await form('abc');
        expect(weak.result().allRequirementsMet).toBe(false);
        expect(weak.result().canSubmit).toBeFalsy();

        const mismatch = await form('Zeta#9xLw', 'Zeta#9xLq');
        expect(mismatch.result().passwordsMatch).toBe(false);
        await act(async () => {
            await mismatch.result().updatePassword();
        });
        expect(PasswordService.updatePassword).not.toHaveBeenCalled();
    });

    test('a strong matching password is saved', async () => {
        PasswordService.updatePassword.mockResolvedValue(undefined);
        const {result, onSuccess} = await form('Zeta#9xLw');
        expect(result().requirements).toMatchObject({length: true, uppercase: true, special: true, noSequential: true});

        await act(async () => {
            await result().updatePassword();
        });

        expect(PasswordService.updatePassword).toHaveBeenCalledWith('a@x.co', 'Zeta#9xLw');
        expect(onSuccess).toHaveBeenCalled();
    });

    test('a backend error is shown and the form can be reset', async () => {
        PasswordService.updatePassword.mockRejectedValue(new Error('La contraseña ya se usó'));
        const {result} = await form('Zeta#9xLw');

        await act(async () => {
            await result().updatePassword();
        });
        expect(result().error).toEqual({type: PasswordUpdateErrorType.GENERIC, message: 'La contraseña ya se usó'});
        expect(result().isLoading).toBe(false);

        act(() => result().resetForm());
        expect(result()).toMatchObject({newPassword: '', confirmPassword: '', error: null});
    });

    test('a request that never answers ends as a timeout', async () => {
        jest.useFakeTimers();
        PasswordService.updatePassword.mockReturnValue(new Promise(() => {}));
        const {result} = await form('Zeta#9xLw');

        let pending;
        act(() => {
            pending = result().updatePassword();
        });
        await act(async () => {
            jest.advanceTimersByTime(15000);
            await pending;
        });

        expect(result().error.type).toBe(PasswordUpdateErrorType.TIMEOUT);
        jest.useRealTimers();
    });
});
