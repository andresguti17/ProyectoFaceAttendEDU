// ERF 6.2 / HU-JUS-002 AC4: rechazar una justificación exige comentario.
import { JustificationService } from '../JustificationService';

jest.mock('../../storage/TokenStorage', () => ({
  getToken: jest.fn(async () => 'session-token'),
  saveToken: jest.fn(),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ justificationId: 5, reviewStatus: 'Rejected' }),
  });
});

describe('JustificationService.reject', () => {
  test.each([undefined, null, '', '   '])('sin comentario (%p) no llama al backend', async (notes) => {
    await expect(JustificationService.reject(5, 'u-1', notes)).rejects.toThrow('REJECTION_NOTES_REQUIRED');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('con comentario envía resolutionNotes recortado', async () => {
    await JustificationService.reject(5, 'u-1', '  soporte ilegible  ');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://gateway.test:8000/api/v1/justifications/5/review');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({
      reviewStatus: 'Rejected',
      reviewedBy: 'u-1',
      resolutionNotes: 'soporte ilegible',
    });
  });

  test('aprobar sigue sin exigir comentario', async () => {
    await JustificationService.approve(5, 'u-1');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ reviewStatus: 'Approved', reviewedBy: 'u-1' });
  });
});
