// Ley 1581: aceptación del aviso (versión vigente + fecha en identity) y revocación biométrica.
import { request } from '../../api/apiClient';
import { ConsentService, PRIVACY_POLICY_VERSION } from '../consentService';

jest.mock('../../api/apiClient', () => ({
  request: jest.fn(),
  GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE',
}));

beforeEach(() => request.mockReset());

describe('ensureAccepted (after login)', () => {
  it('records the acceptance when there is none, without granting biometrics', async () => {
    request.mockResolvedValueOnce({ accepted: false, upToDate: false, biometricAuthorized: false }).mockResolvedValueOnce({});

    await expect(ConsentService.ensureAccepted('p-1')).resolves.toBe(true);

    const post = request.mock.calls[1][0];
    expect(post).toMatchObject({ method: 'POST', url: 'api/v1/persons/p-1/consent' });
    expect(post.data).toEqual({ policyVersion: PRIVACY_POLICY_VERSION, biometricAccepted: false });
  });

  it('re-accepts an outdated notice keeping the biometric choice', async () => {
    request.mockResolvedValueOnce({ accepted: true, upToDate: false, biometricAuthorized: true }).mockResolvedValueOnce({});

    await ConsentService.ensureAccepted('p-1');

    expect(request.mock.calls[1][0].data.biometricAccepted).toBe(true);
  });

  it('does nothing when the notice in force is already accepted', async () => {
    request.mockResolvedValueOnce({ accepted: true, upToDate: true });

    await expect(ConsentService.ensureAccepted('p-1')).resolves.toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('revokeBiometric', () => {
  it('deletes the templates first and then records the revocation', async () => {
    request.mockResolvedValue({});

    await ConsentService.revokeBiometric('p-1');

    expect(request.mock.calls.map(([c]) => `${c.method} ${c.url}`)).toEqual([
      'DELETE api/v1/biometric/persons/p-1',
      'DELETE api/v1/persons/p-1/consent/biometric',
    ]);
  });
});
