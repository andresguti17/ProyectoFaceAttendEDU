import { render, subjectFor, TEMPLATE_VERIFICATION_CODE } from '../render';

describe('render', () => {
  it('rejects an unknown template', () => {
    expect(() => render('other', { code: '123456' })).toThrow(/unknown template/);
  });
  it('requires data.code', () => {
    expect(() => render(TEMPLATE_VERIFICATION_CODE, {})).toThrow(/data.code is required/);
  });
  it('rejects a data value containing template syntax', () => {
    expect(() => render(TEMPLATE_VERIFICATION_CODE, { code: '{{evil}}' })).toThrow(/unsupported characters/);
  });
  it('matches keys case-insensitively and fills defaults', () => {
    const { text, html } = render(TEMPLATE_VERIFICATION_CODE, { Code: '654321' });
    expect(text).toContain('654321');
    expect(text).toContain('FaceAttend EDU');
    expect(text).toContain('10 minutos');
    expect(html).toContain('654321');
  });
  it('fixes the subject regardless of input', () => {
    expect(subjectFor(TEMPLATE_VERIFICATION_CODE)).toBe('Restablece tu contraseña - FaceAttend EDU');
  });
});
