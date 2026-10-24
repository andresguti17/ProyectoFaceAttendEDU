const { assertSafeTarget, safeLogText } = require('../authCheckGuards');

describe('assertSafeTarget', () => {
  it.each([
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://[::1]:3000',
    'http://192.168.1.3:3000',
    'http://10.0.2.2:3000',
    'http://172.16.4.9:3000',
  ])('accepts local target %s', (url) => {
    expect(() => assertSafeTarget(url)).not.toThrow();
  });

  it.each([
    'https://example.com',
    'http://8.8.8.8:3000',
    'http://172.32.0.1:3000',
    'http://169.254.169.254',
    'file:///etc/passwd',
    'ftp://127.0.0.1',
    'not a url',
  ])('rejects %s', (url) => {
    expect(() => assertSafeTarget(url)).toThrow();
  });
});

describe('safeLogText', () => {
  it('replaces line breaks and control characters so entries cannot be forged', () => {
    expect(safeLogText('ok\r\nPASS  forged\u0007')).toBe('ok  PASS  forged ');
  });

  it('leaves normal text alone', () => {
    expect(safeLogText('id=42 (áéí)')).toBe('id=42 (áéí)');
  });
});
