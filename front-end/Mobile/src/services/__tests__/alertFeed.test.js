// Novedades muestra el tipo de alerta en el idioma de la app (ERF 4.2), incluidas las del resultado de una justificación (ERF 6.3).
import { loadScopedAlerts } from '../alertFeed';
import { backendGet } from '../../api/backend';
import i18n from '../../utils/i18n';

jest.mock('../../api/backend', () => ({ backendGet: jest.fn() }));
jest.mock('../JustificationService', () => ({
  getAcademicActorMap: jest.fn(async () => ({ 1: { person_id: 'p-1' } })),
  getPersonCached: jest.fn(async () => ({ name: 'Ana', last_name: 'Ruiz' })),
}));

beforeEach(() => {
  backendGet.mockImplementation(async (_base, path) => (path === 'api/v1/alerts'
    ? [
        { alert_id: 10, academic_actor_id: 1, alert_type_id: 7, raised_at: '2026-10-17T15:43:53Z', resolved_at: null },
        { alert_id: 11, academic_actor_id: 1, alert_type_id: 99, raised_at: '2026-10-16T10:00:00Z', resolved_at: null },
      ]
    : [
        { alert_type_id: 7, code: 'JUSTIFICATION_REJECTED', name: 'Justification rejected' },
        { alert_type_id: 99, code: 'SOMETHING_NEW', name: 'Something new' },
      ]));
});

test('traduce el tipo por código y usa el nombre del catálogo si no hay traducción', async () => {
  await i18n.changeLanguage('es');

  const alerts = await loadScopedAlerts();

  expect(alerts.map((a) => a.title)).toEqual(['Tu justificación fue rechazada', 'Something new']);
  expect(alerts[0].person).toBe('Ana Ruiz');
  expect(alerts.map((a) => a.code)).toEqual(['JUSTIFICATION_REJECTED', 'SOMETHING_NEW']);
});

test('sigue el idioma elegido', async () => {
  await i18n.changeLanguage('fr');

  expect((await loadScopedAlerts())[0].title).toBe('Votre justificatif a été refusé');
  await i18n.changeLanguage('es');
});
