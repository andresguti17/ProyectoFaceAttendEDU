// Soporte de justificación: el archivo real viaja en multipart y el revisor lo abre
// descargándolo con su sesión y pasándolo al visor del sistema.
import { JustificationService } from '../JustificationService';
import { openSupportingDocument, DOCUMENT_ERRORS } from '../supportingDocumentViewer';

jest.mock('../../storage/TokenStorage', () => ({
  getToken: jest.fn(async () => '11111111-2222-3333-4444-555555555555'),
  getSession: jest.fn(async () => null),
  saveToken: jest.fn(async () => true),
}));

const mockDownload = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: Object.assign(
    jest.fn().mockImplementation((dir, name) => ({ uri: `file:///cache/${name}`, name })),
    { downloadFileAsync: (...args) => mockDownload(...args) },
  ),
}));

const mockShare = jest.fn(async () => {});
const mockAvailable = jest.fn(async () => true);
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockAvailable(),
  shareAsync: (...args) => mockShare(...args),
}));

beforeEach(() => {
  mockDownload.mockReset();
  mockShare.mockClear();
  mockAvailable.mockResolvedValue(true);
});

describe('subida del soporte', () => {
  test('envía el archivo en multipart a la justificación, sin Content-Type JSON', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 201, json: async () => ({ supportingDocumentId: 9 }) }));

    const saved = await JustificationService.uploadDocument(4, {
      uri: 'file:///docs/incapacidad.pdf', name: 'incapacidad.pdf', mimeType: 'application/pdf',
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/v1/justifications/4/documents');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.headers.Authorization).toBe('Bearer 11111111-2222-3333-4444-555555555555');
    expect(saved.supporting_document_id).toBe(9);
  });
});

describe('apertura del soporte por el revisor', () => {
  test('descarga con la sesión y lo entrega al visor con su tipo', async () => {
    mockDownload.mockResolvedValue({ uri: 'file:///cache/soporte-7.pdf', name: 'soporte-7.pdf' });

    await openSupportingDocument({ id: 7, mime: 'application/pdf' });

    const [url, , options] = mockDownload.mock.calls[0];
    expect(url).toContain('/api/v1/supporting-documents/7/content');
    expect(options.headers.Authorization).toBe('Bearer 11111111-2222-3333-4444-555555555555');
    expect(mockShare).toHaveBeenCalledWith('file:///cache/soporte-7.pdf', expect.objectContaining({ mimeType: 'application/pdf' }));
  });

  test('un soporte sin contenido (404) se informa como no disponible', async () => {
    mockDownload.mockRejectedValue(new Error('UnableToDownload: 404'));

    await expect(openSupportingDocument({ id: 8, mime: 'application/pdf' }))
      .rejects.toMatchObject({ code: DOCUMENT_ERRORS.NOT_AVAILABLE });
    expect(mockShare).not.toHaveBeenCalled();
  });

  test('sin visor en el dispositivo se informa en vez de fallar en silencio', async () => {
    mockDownload.mockResolvedValue({ uri: 'file:///cache/soporte-7.png', name: 'soporte-7.png' });
    mockAvailable.mockResolvedValue(false);

    await expect(openSupportingDocument({ id: 7, mime: 'image/png' }))
      .rejects.toMatchObject({ code: DOCUMENT_ERRORS.NO_VIEWER });
  });
});
