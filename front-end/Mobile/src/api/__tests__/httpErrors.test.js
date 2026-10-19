import i18n from '../../utils/i18n';
import { httpErrorMessage } from '../httpErrors';

const LANGS = ['es', 'en', 'fr', 'pt'];
const CODES = [0, 204, 299, 301, 399, 400, 401, 403, 404, 409, 418, 422, 429, 500, 502, 503, 504, 599];

afterAll(() => i18n.changeLanguage('es'));

describe('httpErrorMessage', () => {
  test.each(LANGS)('every status family has a real translation in %s', async (lang) => {
    await i18n.changeLanguage(lang);
    for (const code of CODES) {
      const message = httpErrorMessage(code);
      expect(message).not.toMatch(/^httpErrors\./);
      expect(message.length).toBeGreaterThan(10);
    }
  });

  test('unlisted codes fall back to their family message', async () => {
    await i18n.changeLanguage('es');
    expect(httpErrorMessage(418)).toBe(i18n.t('httpErrors.4xx'));
    expect(httpErrorMessage(599)).toBe(i18n.t('httpErrors.5xx'));
    expect(httpErrorMessage(0)).toBe(i18n.t('httpErrors.network'));
  });

  test('validation and conflict errors keep the backend detail', async () => {
    await i18n.changeLanguage('es');
    expect(httpErrorMessage(422, 'email: invalid')).toBe(`${i18n.t('httpErrors.422')} (email: invalid)`);
    expect(httpErrorMessage(500, 'NullPointerException')).toBe(i18n.t('httpErrors.500'));
  });
});
