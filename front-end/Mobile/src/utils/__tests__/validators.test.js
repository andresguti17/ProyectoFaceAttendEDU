// ERF 6.1 / HU-JUS-001 AC4: soporte PDF, JPG o PNG de hasta 5 MB.
import { SUPPORT_FILE_MAX_BYTES, validateSupportFile } from '../validators';

describe('validateSupportFile', () => {
  test.each([
    [{ name: 'incapacidad.pdf', mimeType: 'application/pdf', size: 1000 }],
    [{ name: 'foto.JPG', mimeType: 'image/jpeg', size: 1000 }],
    [{ name: 'foto.jpeg', size: 1000 }],
    [{ name: 'captura.png', mimeType: 'image/png', size: SUPPORT_FILE_MAX_BYTES }],
    [{ name: 'sin-extension', mimeType: 'image/png', size: 1000 }],
  ])('acepta %p', (file) => {
    expect(validateSupportFile(file)).toBeNull();
  });

  test.each([
    [{ name: 'carta.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000 }],
    [{ name: 'carta.doc', mimeType: 'application/msword', size: 1000 }],
    [{ name: 'imagen.gif', mimeType: 'image/gif', size: 1000 }],
    [{}],
  ])('rechaza el formato de %p', (file) => {
    expect(validateSupportFile(file)).toBe('format');
  });

  test('rechaza archivos de más de 5 MB', () => {
    expect(validateSupportFile({ name: 'scan.pdf', size: SUPPORT_FILE_MAX_BYTES + 1 })).toBe('size');
  });
});
