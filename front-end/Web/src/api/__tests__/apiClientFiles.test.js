// Archivos: la subida del soporte va en multipart (FormData) y la descarga vuelve como Blob.
import { request, saveToken, setUnauthorizedHandler } from '../apiClient';
import { attendanceApi } from '../../services/api/attendanceApi';

beforeEach(async () => {
    global.localStorage.clear();
    setUnauthorizedHandler(null);
    await saveToken('11111111-2222-3333-4444-555555555555');
});

test('FormData bodies are sent untouched, without the JSON content type', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 201, text: async () => '{"supportingDocumentId":7}' }));
    const file = new Blob(['%PDF-1.7'], { type: 'application/pdf' });

    const saved = await attendanceApi.uploadJustificationDocument(5, file, 'incapacidad.pdf');

    const [url, init] = global.fetch.mock.calls[0];
    expect(String(url)).toContain('/api/v1/justifications/5/documents');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get('file')).toBeTruthy();
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer 11111111-2222-3333-4444-555555555555');
    expect(saved.supportingDocumentId).toBe(7);
});

test('JSON bodies keep their content type', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => '{}' }));
    await request('/api/v1/justifications', { method: 'POST', body: { reason: 'x' } });
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"reason":"x"}');
});

test('the stored document comes back as a Blob for the reviewer', async () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, blob: async () => pdf }));

    const blob = await attendanceApi.supportingDocumentContent(7);

    expect(String(global.fetch.mock.calls[0][0])).toContain('/api/v1/supporting-documents/7/content');
    expect(blob).toBe(pdf);
});
