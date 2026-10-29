// Contratos de los servicios contra el gateway: método, URL final, cuerpo en el formato que
// espera cada microservicio (camelCase en Java/TS) y lectura de la respuesta (camelCase -> modelo).
// Un filtro o un cuerpo en snake_case que el backend ignora en silencio rompe la pantalla sin error.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { JustificationService, mapConcurrent, getJustificationTypeMap, getAcademicActorMap, getAttendanceRecordCached, getPersonCached, clearJustificationCaches } from '../JustificationService';
import { UserService, getCurrentUser, getCurrentUserRole, getUserProfileRoles, isSuperAdmin, getUserByEmail, hasRole, isAdmin, USER_PROFILE_KEY } from '../UserService';
import { PersonService } from '../PersonService';
import { SchoolService } from '../SchoolService';
import { EnrollmentService } from '../EnrollmentService';
import { AcademicConfigService } from '../AcademicConfigService';
import { PeriodService } from '../PeriodService';
import { ActorService } from '../ActorService';
import { AlertService } from '../AlertService';
import { clearBackendCache } from '../../api/backend';

jest.mock('../../storage/TokenStorage', () => ({
  getToken: jest.fn(async () => 'session-token'),
  getSession: jest.fn(async () => ({ token: 'session-token', savedAt: Date.now() })),
  saveToken: jest.fn(),
}));

const BASE = 'http://gateway.test:8000';

const isReply = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'status' in v && 'body' in v;

/**
 * Responde por URL (sin query) y método; lo no previsto es un 404 del gateway. El valor es el
 * cuerpo (200), { status, body }, o una función (url, options) que devuelve { status?, body }.
 */
function route(table) {
  global.fetch.mockImplementation(async (url, options) => {
    const path = url.replace(BASE, '').split('?')[0];
    const hit = table[`${options.method} ${path}`];
    if (hit === undefined) return { ok: false, status: 404, json: async () => ({ message: 'no route' }) };
    const reply = typeof hit === 'function' ? hit(url, options) : isReply(hit) ? hit : { body: hit };
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body };
  });
}

function calls() {
  return global.fetch.mock.calls.map(([url, options]) => ({
    url,
    method: options.method,
    body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body,
  }));
}

beforeEach(async () => {
  global.fetch = jest.fn();
  clearJustificationCaches();
  clearBackendCache();
  await AsyncStorage.clear();
});

describe('EnrollmentService.getActiveByActor (perfil y detalle de usuario)', () => {
  test('pide la ruta anidada del actor y lee la respuesta camelCase del backend', async () => {
    route({
      'GET /api/v1/academic-actors/12/enrollments': [
        { enrollmentId: 1, academicActorId: 12, cohortId: 7, enrollmentStatus: 'Withdrawn' },
        { enrollmentId: 2, academicActorId: 12, cohortId: 9, enrollmentStatus: 'Active' },
      ],
    });

    const active = await EnrollmentService.getActiveByActor(12);

    expect(calls()[0].url).toBe(`${BASE}/api/v1/academic-actors/12/enrollments`);
    // Antes: GET /enrollments?academic_actor_id=… (filtro ignorado) y cohortId siempre null.
    expect(active).toHaveLength(1);
    expect(active[0].cohortId).toBe(9);
  });

  test('sin actor no consulta nada', async () => {
    await expect(EnrollmentService.getActiveByActor(null)).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('JustificationService', () => {
  test('getAll y getByStatus filtran en el servidor y devuelven modelos', async () => {
    route({ 'GET /api/v1/justifications': [{ justificationId: 4, reviewStatus: 'Pending', reason: 'Cita' }] });

    const [pending] = await JustificationService.getByStatus('Pending');

    expect(calls()[0].url).toBe(`${BASE}/api/v1/justifications?status=Pending`);
    expect(pending).toMatchObject({ justificationId: 4, reason: 'Cita', isPending: true });
  });

  test('getAll sin filtros no manda query', async () => {
    route({ 'GET /api/v1/justifications': [] });

    await JustificationService.getAll();

    expect(calls()[0].url).toBe(`${BASE}/api/v1/justifications`);
  });

  test('getById devuelve null cuando no hay fila', async () => {
    route({ 'GET /api/v1/justifications/9': [] });

    await expect(JustificationService.getById(9)).resolves.toBeNull();
  });

  test('getByActor junta las justificaciones de cada registro del actor', async () => {
    route({
      'GET /api/v1/attendance-records': [{ attendanceRecordId: 1 }, { attendanceRecordId: 2 }],
      'GET /api/v1/justifications': (url) => ({
        body: url.endsWith('attendanceRecordId=1') ? [{ justificationId: 10 }] : [{ justificationId: 20 }],
      }),
    });

    const list = await JustificationService.getByActor(5);

    expect(calls()[0].url).toBe(`${BASE}/api/v1/attendance-records?academicActorId=5`);
    expect(list.map((j) => j.justificationId).sort()).toEqual([10, 20]);
  });

  test('getByActor sin actor devuelve [] sin consultar', async () => {
    await expect(JustificationService.getByActor(undefined)).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('create manda el cuerpo camelCase que espera attendance', async () => {
    route({ 'POST /api/v1/justifications': { status: 201, body: { justificationId: 3, reviewStatus: 'Pending' } } });

    const created = await JustificationService.create({ attendanceRecordId: 8, justificationTypeId: 2, reason: 'Médico' });

    expect(calls()[0]).toMatchObject({ method: 'POST', body: { attendanceRecordId: 8, justificationTypeId: 2, reason: 'Médico' } });
    expect(created.justificationId).toBe(3);
  });

  test('approve envía la decisión, el revisor y las notas a /review', async () => {
    route({ 'PATCH /api/v1/justifications/3/review': { reviewStatus: 'Approved' } });

    const reviewed = await JustificationService.approve(3, 'u-7', 'Soporte válido');

    expect(calls()[0].body).toEqual({ reviewStatus: 'Approved', reviewedBy: 'u-7', resolutionNotes: 'Soporte válido' });
    expect(reviewed.isApproved).toBe(true);
  });

  test('approve sin revisor ni notas no las manda', async () => {
    route({ 'PATCH /api/v1/justifications/3/review': { reviewStatus: 'Approved' } });

    await JustificationService.approve(3);

    expect(calls()[0].body).toEqual({ reviewStatus: 'Approved' });
  });

  test('reject exige un comentario y no llama al backend sin él (ERF 6.2)', async () => {
    await expect(JustificationService.reject(3, 'u-7', '   ')).rejects.toThrow('REJECTION_NOTES_REQUIRED');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('reject recorta el comentario', async () => {
    route({ 'PATCH /api/v1/justifications/3/review': { reviewStatus: 'Rejected' } });

    await JustificationService.reject(3, 'u-7', '  Sin soporte  ');

    expect(calls()[0].body).toMatchObject({ reviewStatus: 'Rejected', resolutionNotes: 'Sin soporte' });
  });

  test('el catálogo de tipos usa /justification-types con cuerpo camelCase', async () => {
    route({
      'GET /api/v1/justification-types': [{ justificationTypeId: 1, name: 'Médica' }],
      'GET /api/v1/justification-types/1': { justificationTypeId: 1, name: 'Médica' },
      'POST /api/v1/justification-types': { status: 201, body: { justificationTypeId: 2, requiresAttachment: true } },
      'PUT /api/v1/justification-types/2': { justificationTypeId: 2, name: 'Calamidad' },
      'DELETE /api/v1/justification-types/2': { status: 204, body: null },
    });

    expect(await JustificationService.getTypes()).toEqual([{ justification_type_id: 1, name: 'Médica' }]);
    expect(await JustificationService.getType(1)).toEqual({ justification_type_id: 1, name: 'Médica' });
    expect(await JustificationService.createType({ name: 'Calamidad', requiresAttachment: true }))
      .toEqual({ justification_type_id: 2, requires_attachment: true });
    await JustificationService.updateType(2, { name: 'Calamidad' });
    await JustificationService.deleteType(2);

    const sent = calls();
    expect(sent[2].body).toEqual({ name: 'Calamidad', description: null, requiresAttachment: true });
    expect(sent[3]).toMatchObject({ method: 'PUT', body: { name: 'Calamidad', description: null, requiresAttachment: false } });
    expect(sent[4].method).toBe('DELETE');
  });

  test('getType devuelve null si el tipo no existe', async () => {
    route({ 'GET /api/v1/justification-types/99': [] });

    await expect(JustificationService.getType(99)).resolves.toBeNull();
  });

  test('uploadDocument sube el archivo como multipart a la justificación', async () => {
    route({ 'POST /api/v1/justifications/3/documents': { status: 201, body: { supportingDocumentId: 5 } } });

    const doc = await JustificationService.uploadDocument(3, { uri: 'file:///x.pdf', name: 'x.pdf', mimeType: 'application/pdf' });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers['Content-Type']).toBeUndefined(); // fetch pone el boundary
    expect(doc).toEqual({ supporting_document_id: 5 });
  });

  test('getDocuments filtra por justificación', async () => {
    route({ 'GET /api/v1/supporting-documents': [] });

    await JustificationService.getDocuments(3);

    expect(calls()[0].url).toBe(`${BASE}/api/v1/supporting-documents?justificationId=3`);
  });

  test('delete borra por id', async () => {
    route({ 'DELETE /api/v1/justifications/3': { status: 204, body: null } });

    await JustificationService.delete(3);

    expect(calls()[0].method).toBe('DELETE');
  });
});

describe('cachés de enriquecimiento de justificaciones', () => {
  test('el mapa de tipos se pide una sola vez aunque lo pidan dos pantallas a la vez', async () => {
    route({ 'GET /api/v1/justification-types': [{ justificationTypeId: 1, name: 'Médica' }] });

    const [a, b] = await Promise.all([getJustificationTypeMap(), getJustificationTypeMap()]);

    expect(a).toBe(b);
    expect(a[1].name).toBe('Médica');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('un fallo del catálogo deja el mapa vacío en vez de romper la pantalla', async () => {
    route({});

    await expect(getJustificationTypeMap()).resolves.toEqual({});
    await expect(getAcademicActorMap()).resolves.toEqual({});
  });

  test('el mapa de actores se indexa por id', async () => {
    route({ 'GET /api/v1/academic-actors': [{ academicActorId: 3, personId: 'p-3' }] });

    const map = await getAcademicActorMap();

    expect(map['3'].person_id).toBe('p-3');
  });

  test('registro y persona se cachean por id y un error queda en null', async () => {
    route({ 'GET /api/v1/attendance-records/1': { attendanceRecordId: 1 } });

    expect(await getAttendanceRecordCached(1)).toEqual({ attendance_record_id: 1 });
    expect(await getAttendanceRecordCached(1)).toEqual({ attendance_record_id: 1 });
    expect(await getPersonCached('p-404')).toBeNull();
    expect(await getPersonCached(null)).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('mapConcurrent mantiene el orden, acota la concurrencia y descarta los fallos', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapConcurrent([1, 2, 3, 4, 5], async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 1));
      running -= 1;
      if (n === 3) throw new Error('boom');
      return n * 10;
    }, 2);

    expect(out).toEqual([10, 20, 40, 50]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('UserService', () => {
  test('create manda camelCase sin nulos a /users', async () => {
    route({ 'POST /api/v1/users': { status: 201, body: { userId: 'u-1', personId: 'p-1', username: 'ana' } } });

    const user = await UserService.create({ person_id: 'p-1', username: 'ana', password: 'Secret-123', authenticationType: null });

    expect(calls()[0].body).toEqual({ personId: 'p-1', username: 'ana', password: 'Secret-123' });
    expect(user).toMatchObject({ userId: 'u-1', personId: 'p-1' });
  });

  test('update manda solo los campos presentes', async () => {
    route({ 'PUT /api/v1/users/u-1': { userId: 'u-1', status: false } });

    await UserService.update('u-1', { username: 'ana', status: false });

    expect(calls()[0].body).toEqual({ username: 'ana', status: false });
  });

  test('setStatus usa PATCH /users/:id/status con el estado en la query', async () => {
    route({ 'PATCH /api/v1/users/u-1/status': { status: 204, body: null } });

    await UserService.setStatus('u-1', false);

    expect(calls()[0]).toMatchObject({ method: 'PATCH', url: `${BASE}/api/v1/users/u-1/status?status=false` });
  });

  test('getAll/getById/getByUsername leen la respuesta camelCase', async () => {
    route({
      'GET /api/v1/users': [{ userId: 'u-1', username: 'ana' }],
      'GET /api/v1/users/u-1': { userId: 'u-1', username: 'ana' },
    });

    expect((await UserService.getAll())[0].userId).toBe('u-1');
    expect((await UserService.getById('u-1')).username).toBe('ana');
    expect((await UserService.getByUsername('ana')).userId).toBe('u-1');
  });

  test('delete borra por id', async () => {
    route({ 'DELETE /api/v1/users/u-1': { status: 204, body: null } });

    await UserService.delete('u-1');

    expect(calls()[0].method).toBe('DELETE');
  });
});

describe('usuario actual guardado en el dispositivo', () => {
  test('lee el perfil guardado y prefiere el rol canónico', async () => {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify({ userId: 'u-1', personId: 'p-1', email: 'a@x.co', roles: ['Super Administrador'] }));
    await AsyncStorage.setItem('userRole', 'ADMIN');

    expect(await getCurrentUser()).toMatchObject({ userId: 'u-1', personId: 'p-1', roles: ['ADMIN'] });
    expect(await getCurrentUserRole()).toBe('ADMIN');
    expect(await getUserProfileRoles()).toEqual(['Super Administrador']);
    expect(await isSuperAdmin()).toBe(true);
    expect(await hasRole('ADMIN')).toBe(true);
    expect(await isAdmin()).toBe(false);
  });

  test('un Administrador de sede no es super administrador', async () => {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify({ userId: 'u-2', roles: ['Administrador'] }));

    expect(await isSuperAdmin()).toBe(false);
  });

  test('sin perfil ni correo no hay usuario', async () => {
    expect(await getCurrentUser()).toBeNull();
    expect(await getUserProfileRoles()).toEqual([]);
  });

  test('un perfil corrupto no rompe la lectura', async () => {
    await AsyncStorage.setItem(USER_PROFILE_KEY, '{no-json');

    expect(await getCurrentUser()).toBeNull();
  });

  test('sin perfil cae a buscar por el correo guardado', async () => {
    await AsyncStorage.setItem('userEmail', 'Ana@X.co');
    route({
      'GET /api/v1/persons': [{ personId: 'p-1', email: 'ana@x.co' }],
      'GET /api/v1/users': [{ userId: 'u-1', personId: 'p-1', username: 'ana' }],
    });

    expect(await getCurrentUser()).toMatchObject({ userId: 'u-1', personId: 'p-1', email: 'Ana@X.co', roles: [] });
  });

  test('getUserByEmail devuelve null sin correo o sin persona', async () => {
    route({ 'GET /api/v1/persons': [] });

    expect(await getUserByEmail('')).toBeNull();
    expect(await getUserByEmail('nadie@x.co')).toBeNull();
  });
});

describe('PersonService', () => {
  test('update arma el cuerpo camelCase que valida identity', async () => {
    route({ 'PUT /api/v1/persons/p-1': { personId: 'p-1', name: 'Ana', lastName: 'Pérez' } });

    const person = await PersonService.update('p-1', { document_number: '123', name: 'Ana', last_name: 'Pérez', email: null });

    expect(calls()[0].body).toEqual({ documentNumber: '123', name: 'Ana', lastName: 'Pérez' });
    expect(person.fullName).toBe('Ana Pérez');
  });

  test('create omite los nulos y lee la respuesta', async () => {
    route({ 'POST /api/v1/persons': { status: 201, body: { personId: 'p-2', name: 'Luis', lastName: 'Gil' } } });

    const person = await PersonService.create({ documentNumber: '9', name: 'Luis', lastName: 'Gil', documentType: 'CC', phone: undefined });

    expect(calls()[0].body).toEqual({ documentNumber: '9', name: 'Luis', lastName: 'Gil', documentType: 'CC' });
    expect(person.personId).toBe('p-2');
  });

  test('updateFields manda los campos tal cual', async () => {
    route({ 'PUT /api/v1/persons/p-1': { personId: 'p-1', phone: '300' } });

    await PersonService.updateFields('p-1', { phone: '300' });

    expect(calls()[0].body).toEqual({ phone: '300' });
  });

  test('setStatus usa PATCH /persons/:id/status', async () => {
    route({ 'PATCH /api/v1/persons/p-1/status': { status: 204, body: null } });

    await PersonService.setStatus('p-1', true);

    expect(calls()[0].url).toBe(`${BASE}/api/v1/persons/p-1/status?status=true`);
  });

  test('getById y getAll normalizan la respuesta', async () => {
    route({ 'GET /api/v1/persons/p-1': { personId: 'p-1', documentNumber: '1' }, 'GET /api/v1/persons': [{ personId: 'p-1' }] });

    expect((await PersonService.getById('p-1')).documentNumber).toBe('1');
    expect((await PersonService.getAll())[0].personId).toBe('p-1');
  });
});

describe('SchoolService', () => {
  test('update manda camelCase (antes snake: el guardado era un no-op)', async () => {
    route({ 'PUT /api/v1/schools/2': { schoolId: 2, name: 'Sede Norte', cityId: 11 } });

    const school = await SchoolService.update(2, { code: 'N', name: 'Sede Norte', city_id: 11, phone: null });

    expect(calls()[0].body).toEqual({ code: 'N', name: 'Sede Norte', cityId: 11 });
    expect(school).toMatchObject({ schoolId: 2, cityId: 11 });
  });

  test('getCurrentSchoolId usa la sede del actor del usuario', async () => {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify({ userId: 'u-1', personId: 'p-1' }));
    route({ 'GET /api/v1/academic-actors': [{ academicActorId: 5, personId: 'p-1', schoolId: 4 }] });

    await expect(SchoolService.getCurrentSchoolId()).resolves.toBe(4);
  });

  test('sin actor propio toma la sede con más actores', async () => {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify({ userId: 'u-1', personId: 'p-admin' }));
    route({
      'GET /api/v1/academic-actors': (url) => ({
        body: url.includes('personId=') ? [] : [{ schoolId: 2 }, { schoolId: 3 }, { schoolId: 3 }],
      }),
    });

    await expect(SchoolService.getCurrentSchoolId()).resolves.toBe(3);
  });

  test('sin actores toma la primera sede', async () => {
    route({ 'GET /api/v1/academic-actors': [], 'GET /api/v1/schools': [{ schoolId: 8 }] });

    await expect(SchoolService.getCurrentSchoolId()).resolves.toBe(8);
  });

  test('create, getById y delete usan /schools', async () => {
    route({
      'POST /api/v1/schools': { status: 201, body: { schoolId: 9, name: 'Nueva' } },
      'GET /api/v1/schools/9': { schoolId: 9, name: 'Nueva' },
      'DELETE /api/v1/schools/9': { status: 204, body: null },
    });

    expect((await SchoolService.create({ name: 'Nueva', code: 'NV' })).schoolId).toBe(9);
    expect((await SchoolService.getById(9)).name).toBe('Nueva');
    await SchoolService.delete(9);
    expect(calls().map((c) => c.method)).toEqual(['POST', 'GET', 'DELETE']);
  });
});

describe('AcademicConfigService', () => {
  test('getBySchool filtra en el cliente lo que el listado no filtra', async () => {
    route({
      'GET /api/v1/academic-configurations': [
        { configurationId: 1, schoolId: 2, configurationName: 'min_attendance', configurationValue: '80' },
        { configurationId: 2, schoolId: 3, configurationName: 'min_attendance', configurationValue: '70' },
      ],
    });

    const configs = await AcademicConfigService.getBySchool(2);

    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({ configurationId: 1, numericValue: 80 });
  });

  test('getByName busca por nombre y sede', async () => {
    route({
      'GET /api/v1/academic-configurations': [
        { configurationId: 1, schoolId: 2, configurationName: 'tardy_tolerance_minutes', configurationValue: '10' },
      ],
    });

    const found = await AcademicConfigService.getByName(2, 'tardy_tolerance_minutes');

    expect(calls()[0].url).toBe(`${BASE}/api/v1/academic-configurations?name=tardy_tolerance_minutes`);
    expect(found.configurationValue).toBe('10');
    expect(await AcademicConfigService.getByName(5, 'tardy_tolerance_minutes')).toBeNull();
  });

  test('create y update mandan camelCase sin nulos', async () => {
    route({
      'POST /api/v1/academic-configurations': { status: 201, body: { configurationId: 4 } },
      'PUT /api/v1/academic-configurations/4': { configurationId: 4 },
    });

    await AcademicConfigService.create({ school_id: 2, configuration_name: 'min_attendance', configuration_value: '80', description: null });
    await AcademicConfigService.update(4, { configurationValue: '85' });

    expect(calls()[0].body).toEqual({ schoolId: 2, configurationName: 'min_attendance', configurationValue: '80' });
    expect(calls()[1].body).toEqual({ configurationValue: '85' });
  });
});

describe('PeriodService', () => {
  test('getActiveBySchool devuelve el período activo de la sede', async () => {
    route({
      'GET /api/v1/academic-periods': [
        { academicPeriodId: 1, schoolId: 2, isActive: false },
        { academicPeriodId: 2, schoolId: 2, isActive: true },
        { academicPeriodId: 3, schoolId: 4, isActive: true },
      ],
    });

    expect((await PeriodService.getActiveBySchool(2)).academicPeriodId).toBe(2);
    expect((await PeriodService.getBySchool(2)).map((p) => p.academicPeriodId)).toEqual([1, 2]);
    expect(await PeriodService.getActiveBySchool(9)).toBeNull();
  });
});

describe('ActorService', () => {
  test('getBySchool usa la ruta anidada y filtra por tipo de actor', async () => {
    route({
      'GET /api/v1/schools/2/actors': [
        { academicActorId: 1, actorTypeId: 1 },
        { academicActorId: 2, actorTypeId: 2 },
      ],
    });

    expect((await ActorService.getStudents(2)).map((a) => a.academicActorId)).toEqual([1]);
    expect((await ActorService.getInstructors(2)).map((a) => a.academicActorId)).toEqual([2]);
    expect(await ActorService.getBySchool(2)).toHaveLength(2);
  });

  test('getByPerson sin persona no consulta', async () => {
    await expect(ActorService.getByPerson(null)).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('create manda camelCase sin nulos', async () => {
    route({ 'POST /api/v1/academic-actors': { status: 201, body: { academicActorId: 3 } } });

    const actor = await ActorService.create({ person_id: 'p-1', actorTypeId: 1, schoolId: 2, actorCode: null });

    expect(calls()[0].body).toEqual({ personId: 'p-1', actorTypeId: 1, schoolId: 2 });
    expect(actor.academicActorId).toBe(3);
  });
});

describe('AlertService.markResolved', () => {
  test('usa el endpoint dedicado y lee la respuesta camelCase', async () => {
    route({ 'PATCH /api/v1/alerts/5/resolve': { alertId: 5, resolvedAt: '2026-10-28T10:00:00Z' } });

    const alert = await AlertService.markResolved(5);

    expect(calls()[0].method).toBe('PATCH');
    expect(alert).toBeTruthy();
  });
});

describe('errores del backend', () => {
  test('un 403 llega al llamador como error con el estado', async () => {
    route({ 'GET /api/v1/justifications': { status: 403, body: { message: 'Forbidden' } } });

    await expect(JustificationService.getAll({ status: 'Pending' })).rejects.toMatchObject({ status: 403 });
  });
});
