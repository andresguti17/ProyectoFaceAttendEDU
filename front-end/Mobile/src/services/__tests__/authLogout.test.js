// El id de sesión es un bearer: el cliente lo adjunta como cabecera, nunca en la URL (que queda en los logs).
import { request } from '../../api/apiClient';
import { AuthService } from '../AuthService';

jest.mock('../../api/apiClient', () => ({
  request: jest.fn(),
  GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE',
}));

beforeEach(() => request.mockReset());

describe('logout', () => {
  it('calls the endpoint without the session id in the query string', async () => {
    request.mockResolvedValueOnce({});

    await AuthService.logout('11111111-2222-3333-4444-555555555555');

    const call = request.mock.calls[0][0];
    expect(call).toMatchObject({ method: 'POST', url: 'api/v1/auth/logout', requiresAuth: false });
    expect(call.params).toBeUndefined();
  });

  it('does nothing without a session and never throws when the request fails', async () => {
    await AuthService.logout(null);
    expect(request).not.toHaveBeenCalled();

    request.mockRejectedValueOnce(new Error('offline'));
    await expect(AuthService.logout('11111111-2222-3333-4444-555555555555')).resolves.toBeUndefined();
  });
});
