import { render, subjectFor, SUPPORTED_TEMPLATES, TEMPLATE_USER_CREDENTIALS, TEMPLATE_VERIFICATION_CODE } from '../render';

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

describe('user_credentials template', () => {
  const data = { Username: 'ana.perez', Password: 'Str0ng!Pass#1', RecipientName: 'Ana', LoginUrl: 'https://app.faceattend.edu/login' };

  it('is on the whitelist with its own fixed subject', () => {
    expect(SUPPORTED_TEMPLATES).toEqual(expect.arrayContaining([TEMPLATE_VERIFICATION_CODE, TEMPLATE_USER_CREDENTIALS]));
    expect(subjectFor(TEMPLATE_USER_CREDENTIALS)).toBe('Tus credenciales de acceso - FaceAttend EDU');
  });

  it('requires username and password', () => {
    expect(() => render(TEMPLATE_USER_CREDENTIALS, { password: 'x' })).toThrow(/data.username is required/);
    expect(() => render(TEMPLATE_USER_CREDENTIALS, { username: 'x' })).toThrow(/data.password is required/);
  });

  it('shows the credentials, the login URL and the change-password advice in both bodies', () => {
    const { text, html } = render(TEMPLATE_USER_CREDENTIALS, data);
    for (const body of [text, html]) {
      expect(body).toContain('ana.perez');
      expect(body).toContain('Str0ng!Pass#1');
      expect(body).toContain('https://app.faceattend.edu/login');
    }
    expect(text).toContain('cambia tu contraseña');
    expect(text).toContain('Hola, Ana');
  });

  it('escapes caller values in the HTML body only', () => {
    const { text, html } = render(TEMPLATE_USER_CREDENTIALS, { username: '<b>x</b>', password: 'a&b"c', recipientname: '<script>' });
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('a&amp;b&quot;c');
    expect(text).toContain('<b>x</b>');
  });

  it('omits the login line when no URL is given', () => {
    const { text } = render(TEMPLATE_USER_CREDENTIALS, { username: 'u', password: 'p' });
    expect(text).not.toContain('Ingresa en');
  });
});

describe('verification_code HTML escaping', () => {
  it('escapes the recipient name', () => {
    const { html } = render(TEMPLATE_VERIFICATION_CODE, { code: '123456', recipientname: '<i>x</i>' });
    expect(html).not.toContain('<i>x</i>');
  });
});
