// Peticiones que la web ya hacía y el móvil no tenía (paridad con front-end/Web/src/services/api).
// Se verifica método, URL final contra el gateway, cuerpo, Bearer y mapeo a modelos.
import {
  ProgramService,
  CourseService,
  CohortService,
  EnrollmentService,
  SessionService,
  AttendanceService,
  AuthService,
  PasswordPolicyService,
  ActorTypeService,
  UserRoleService,
  AlertTypeService,
  QualityService,
  FaceAuthService,
  ActorService,
  ClassSessionService,
  AlertService,
  BiometricCaseService,
  AcademicConfigService,
} from '../index';

jest.mock('../../storage/TokenStorage', () => ({
  getToken: jest.fn(async () => 'session-token'),
  saveToken: jest.fn(),
}));

const BASE = 'http://gateway.test:8000';

function mockResponse(body, status = 200) {
  global.fetch.mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

function lastCall() {
  const [url, options] = global.fetch.mock.calls.at(-1);
  return { url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, headers: options.headers };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('rutas anidadas del dominio académico', () => {
  test.each([
    ['ProgramService.listBySchool', () => ProgramService.listBySchool(3), '/api/v1/schools/3/programs', { programId: 9, schoolId: 3 }, 'programId', 9],
    ['CourseService.listByProgram', () => CourseService.listByProgram(4), '/api/v1/programs/4/courses', { courseId: 8, programId: 4 }, 'courseId', 8],
    ['CohortService.listByProgram', () => CohortService.listByProgram(4), '/api/v1/programs/4/cohorts', { cohortId: 7, programId: 4 }, 'cohortId', 7],
    ['EnrollmentService.listByCohort', () => EnrollmentService.listByCohort(5), '/api/v1/cohorts/5/enrollments', { enrollmentId: 6, cohortId: 5 }, 'enrollmentId', 6],
    ['SessionService.listByUser', () => SessionService.listByUser('u-1'), '/api/v1/sessions/user/u-1', { sessionId: 's-1', userId: 'u-1' }, 'sessionId', 's-1'],
  ])('%s', async (_name, call, path, row, key, expected) => {
    mockResponse([row]);

    const result = await call();

    const sent = lastCall();
    expect(sent.method).toBe('GET');
    expect(sent.url).toBe(`${BASE}${path}`);
    expect(sent.headers.Authorization).toBe('Bearer session-token');
    expect(result).toHaveLength(1);
    expect(result[0][key]).toBe(expected); // camelCase del backend -> modelo del móvil
  });

  test('una ruta anidada vacía devuelve []', async () => {
    mockResponse([]);
    await expect(CourseService.listByProgram(99)).resolves.toEqual([]);
  });
});

describe('AttendanceService.getSummary', () => {
  test('pide el resumen por actor y devuelve Map<actorId, conteos>', async () => {
    mockResponse({ 1: { present: 2, late: 0, absent: 1, justified: 0, total: 3 } });

    const summary = await AttendanceService.getSummary([1, 2]);

    const sent = lastCall();
    expect(sent.method).toBe('GET');
    expect(sent.url).toBe(`${BASE}/api/v1/attendance-records/summary?academicActorIds=1%2C2`);
    expect(summary.get(1)).toEqual({ present: 2, late: 0, absent: 1, justified: 0, total: 3 });
  });

  test('parte los ids en lotes de 200 y deduplica', async () => {
    mockResponse({});
    const ids = Array.from({ length: 450 }, (_, i) => i + 1);

    await AttendanceService.getSummary([...ids, 1, 2]);

    expect(global.fetch).toHaveBeenCalledTimes(3); // 200 + 200 + 50
  });

  test('sin ids no hace ninguna petición', async () => {
    await expect(AttendanceService.getSummary([])).resolves.toEqual(new Map());
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('identidad y autorización', () => {
  test('AuthService.me usa email si el identificador lo es y username si no', async () => {
    mockResponse({ userId: 'u-1', personId: 'p-1', username: 'seed.admin', status: true });

    const byUsername = await AuthService.me('seed.admin');
    expect(lastCall().url).toBe(`${BASE}/api/v1/auth/me?username=seed.admin`);
    expect(byUsername).toMatchObject({ userId: 'u-1', personId: 'p-1', username: 'seed.admin' });

    await AuthService.me('ana@sena.edu.co');
    expect(lastCall().url).toBe(`${BASE}/api/v1/auth/me?email=ana%40sena.edu.co`);
  });

  test('PasswordPolicyService.getAll desenvuelve { data } y mapea el modelo', async () => {
    mockResponse({ data: [{ policyId: 1, minLength: 10, maxLength: 30, requiresSymbols: false, expirationDays: 60 }] });

    const [policy] = await PasswordPolicyService.getAll();

    expect(lastCall()).toMatchObject({ method: 'GET', url: `${BASE}/api/v1/password-policies` });
    expect(policy).toMatchObject({ policyId: 1, minLength: 10, maxLength: 30, requiresSymbols: false, expirationDays: 60 });
  });

  test('ActorTypeService.getAll mapea STUDENT / INSTRUCTOR', async () => {
    mockResponse([
      { actorTypeId: 1, code: 'STUDENT', name: 'Estudiante' },
      { actorTypeId: 2, code: 'INSTRUCTOR', name: 'Instructor' },
    ]);

    const types = await ActorTypeService.getAll();

    expect(lastCall()).toMatchObject({ method: 'GET', url: `${BASE}/api/v1/actor-types` });
    expect(types.map((t) => t.code)).toEqual(['STUDENT', 'INSTRUCTOR']);
  });

  test('UserRoleService.assign hace POST /users/:id/roles con { roleId }', async () => {
    mockResponse({ userId: 'u-1', roleId: 2 }, 201);

    await UserRoleService.assign('u-1', 2);

    expect(lastCall()).toMatchObject({
      method: 'POST',
      url: `${BASE}/api/v1/users/u-1/roles`,
      body: { roleId: 2 },
    });
  });

  test('UserRoleService.getByUsers pide los roles de varios usuarios en una petición', async () => {
    mockResponse({ 'u-1': [{ roleId: 1, roleName: 'Administrador' }], 'u-2': [{ roleId: 4, roleName: 'Aprendiz' }] });

    const roles = await UserRoleService.getByUsers(['u-1', 'u-2', 'u-1']);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(lastCall().url).toBe(`${BASE}/api/v1/user-roles?userIds=u-1%2Cu-2`);
    expect(roles.get('u-1')[0]).toMatchObject({ roleId: 1, roleName: 'Administrador' });
    expect(roles.get('u-2')[0].roleName).toBe('Aprendiz');
    expect(roles.has('u-3')).toBe(false);
  });
});

describe('notificación y calidad', () => {
  test('AlertTypeService.create hace POST /alert-types y mapea la respuesta PascalCase del servicio Go', async () => {
    mockResponse({ AlertTypeID: 6, Code: 'CUSTOM', Name: 'Custom', Severity: 'INFO', Channel: 'EMAIL' }, 201);

    const created = await AlertTypeService.create({ code: 'CUSTOM', name: 'Custom', severity: 'INFO', channel: 'EMAIL' });

    expect(lastCall()).toMatchObject({
      method: 'POST',
      url: `${BASE}/api/v1/alert-types`,
      body: { code: 'CUSTOM', name: 'Custom', severity: 'INFO', channel: 'EMAIL' },
    });
    expect(created).toMatchObject({ alertTypeId: 6, code: 'CUSTOM', name: 'Custom' });
  });

  test('AlertTypeService.create no envía channel si no se indica (el backend usa DASHBOARD)', async () => {
    mockResponse({ AlertTypeID: 7, Code: 'X', Name: 'X' }, 201);

    await AlertTypeService.create({ code: 'X', name: 'X', severity: 'WARNING' });

    expect(lastCall().body).toEqual({ code: 'X', name: 'X', severity: 'WARNING' });
  });

  test.each([
    ['getCharacteristics', () => QualityService.getCharacteristics(), '/api/v1/quality/characteristics'],
    ['getEvaluations', () => QualityService.getEvaluations({ service: 'ms-identity' }), '/api/v1/quality/evaluations?service=ms-identity'],
    ['getServiceSummary', () => QualityService.getServiceSummary('ms identity'), '/api/v1/quality/services/ms%20identity/summary'],
    ['getProcessProfile', () => QualityService.getProcessProfile(), '/api/v1/quality/process/profile'],
    ['getProjects', () => QualityService.getProjects(), '/api/v1/quality/projects'],
    ['getIstqbCategories', () => QualityService.getIstqbCategories(), '/api/v1/quality/istqb/categories'],
  ])('QualityService.%s', async (_name, call, path) => {
    mockResponse({ total_questions: 24, totalQuestions: 24 });

    const data = await call();

    expect(lastCall()).toMatchObject({ method: 'GET', url: `${BASE}${path}` });
    expect(data.total_questions).toBe(24); // normalizado a snake_case como el resto del móvil
  });
});

describe('FaceAuthService (biometría vía /api/v1/biometric, fusionado en ms-biometric)', () => {
  const F = `${BASE}/api/v1/biometric`;

  test.each([
    ['health', () => FaceAuthService.health(), 'GET', '/health', undefined],
    ['getLivenessChallenge', () => FaceAuthService.getLivenessChallenge(2), 'GET', '/facial/liveness-challenge?actions=2', undefined],
    ['getLivenessChallenge (3 por defecto)', () => FaceAuthService.getLivenessChallenge(), 'GET', '/facial/liveness-challenge?actions=3', undefined],
    [
      'submitLivenessStep',
      () => FaceAuthService.submitLivenessStep({ challengeToken: 'tok', actionIndex: 1, images: ['a', 'b'] }),
      'POST',
      '/facial/liveness-step',
      { challenge_token: 'tok', action_index: 1, images: ['a', 'b'] },
    ],
    [
      'enrollFace',
      () => FaceAuthService.enrollFace({ personId: 'p-1', imageBase64: 'img', challengeToken: 'tok' }),
      'POST',
      '/facial/enroll-image',
      { person_id: 'p-1', image_base64: 'img', challenge_token: 'tok' },
    ],
    [
      'identifyFace',
      () => FaceAuthService.identifyFace({ imageBase64: 'img', challengeToken: 'tok' }),
      'POST',
      '/facial/identify-image',
      { image_base64: 'img', challenge_token: 'tok' },
    ],
    [
      'enrollFingerprint',
      () => FaceAuthService.enrollFingerprint({ personId: 'p-1', fingerNumber: 1, sampleFormat: 5, data: 'b64', quality: 80 }),
      'POST',
      '/fingerprint/enroll-sample',
      { person_id: 'p-1', finger_number: 1, sample_format: 5, data_base64: 'b64', quality: 80 },
    ],
    [
      'identifyFingerprint',
      () => FaceAuthService.identifyFingerprint({ sampleFormat: 5, data: 'b64', quality: 80, fingerNumber: 1 }),
      'POST',
      '/fingerprint/identify-sample',
      { sample_format: 5, data_base64: 'b64', quality: 80, finger_number: 1 },
    ],
    ['summary', () => FaceAuthService.summary('p-1'), 'GET', '/p-1/summary', undefined],
    ['revokeFace', () => FaceAuthService.revokeFace('p-1'), 'DELETE', '/facial/p-1', undefined],
    ['deleteFingerprint', () => FaceAuthService.deleteFingerprint('p-1', 1), 'DELETE', '/fingerprint/p-1/1', undefined],
  ])('%s', async (_name, call, method, path, body) => {
    mockResponse({ ok: true });

    await call();

    const sent = lastCall();
    expect(sent.method).toBe(method);
    expect(sent.url).toBe(`${F}${path}`);
    expect(sent.body).toEqual(body);
    expect(sent.headers.Authorization).toBe('Bearer session-token');
  });

  test('una huella/rostro no reconocidos llegan como 404, no como sesión caducada', async () => {
    mockResponse({ error: 'NotFound', message: 'no match found' }, 404);

    await expect(FaceAuthService.identifyFace({ imageBase64: 'img', challengeToken: 'tok' })).rejects.toMatchObject({
      status: 404,
      detail: 'no match found',
    });
  });
});

describe('acciones dedicadas del backend', () => {
  test.each([
    ['openById', () => ClassSessionService.openById(12, 5), '/api/v1/class-sessions/12/open', { openedBy: 5 }],
    ['openById sin actor', () => ClassSessionService.openById(12), '/api/v1/class-sessions/12/open', undefined],
    ['closeById', () => ClassSessionService.closeById(12, 5), '/api/v1/class-sessions/12/close', { closedBy: 5 }],
    ['cancelById', () => ClassSessionService.cancelById(12), '/api/v1/class-sessions/12/cancel', undefined],
  ])('ClassSessionService.%s hace POST y mapea la sesión', async (_name, call, path, body) => {
    mockResponse({ classSessionId: 12, scheduleBlockId: 3, sessionStatus: 'Open' });

    const session = await call();

    const sent = lastCall();
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe(`${BASE}${path}`);
    expect(sent.body).toEqual(body);
    expect(session).toMatchObject({ classSessionId: 12, scheduleBlockId: 3, sessionStatus: 'Open' });
  });

  test('AlertService.markResolved hace PATCH /alerts/:id/resolve y mapea la respuesta PascalCase', async () => {
    mockResponse({ AlertID: 4, AcademicActorID: 9, AlertTypeID: 1, RaisedAt: '2026-10-01T00:00:00Z', ResolvedAt: '2026-10-02T00:00:00Z' });

    const alert = await AlertService.markResolved(4);

    expect(lastCall()).toMatchObject({ method: 'PATCH', url: `${BASE}/api/v1/alerts/4/resolve` });
    expect(alert).toMatchObject({ alertId: 4, academicActorId: 9, alertTypeId: 1 });
  });

  test('BiometricCaseService.review hace PATCH con updateStatus y solo envía lo informado', async () => {
    mockResponse({ caseId: 'c-1', personId: 'p-1', updateStatus: 'Approved', reviewedBy: 'u-1' });

    const reviewed = await BiometricCaseService.review('c-1', {
      updateStatus: 'Approved',
      reviewedBy: 'u-1',
      resolutionNotes: 'Ok',
    });

    expect(lastCall()).toMatchObject({
      method: 'PATCH',
      url: `${BASE}/api/v1/biometric-update-cases/c-1/review`,
      body: { updateStatus: 'Approved', reviewedBy: 'u-1', resolutionNotes: 'Ok' },
    });
    expect(reviewed).toMatchObject({ caseId: 'c-1', updateStatus: 'Approved' });

    await BiometricCaseService.review('c-1', { updateStatus: 'In_Review' });
    expect(lastCall().body).toEqual({ updateStatus: 'In_Review' });
  });
});

describe('configuración y tipos de alerta', () => {
  test('AcademicConfigService.listBySchool usa la ruta anidada de la sede', async () => {
    mockResponse([{ configurationId: 2, schoolId: 3, configurationName: 'tardy_tolerance_minutes', configurationValue: '10' }]);

    const [config] = await AcademicConfigService.listBySchool(3);

    expect(lastCall()).toMatchObject({ method: 'GET', url: `${BASE}/api/v1/schools/3/configurations` });
    expect(config).toMatchObject({ configurationId: 2, schoolId: 3, configurationValue: '10' });
  });

  test('AlertTypeService.getAll desenvuelve { alert_types } del servicio Go', async () => {
    mockResponse({ alert_types: [{ AlertTypeID: 1, Code: 'ATTENDANCE_ABSENTEEISM', Name: 'Recurrent absenteeism' }] });

    const types = await AlertTypeService.getAll();

    expect(lastCall()).toMatchObject({ method: 'GET', url: `${BASE}/api/v1/alert-types` });
    expect(types).toHaveLength(1);
    expect(types[0]).toMatchObject({ alertTypeId: 1, code: 'ATTENDANCE_ABSENTEEISM' });
  });

  test('AlertTypeService.getAll con { alert_types: null } devuelve []', async () => {
    mockResponse({ alert_types: null });
    await expect(AlertTypeService.getAll()).resolves.toEqual([]);
  });
});

describe('las peticiones existentes no cambian', () => {
  test('ClassSessionService.close/cancel siguen usando PUT', async () => {
    mockResponse({ class_session_id: 1 });

    await ClassSessionService.cancel(1);
    expect(lastCall()).toMatchObject({ method: 'PUT', url: `${BASE}/api/v1/class-sessions/1` });

    await ClassSessionService.close(1, 5);
    expect(lastCall()).toMatchObject({ method: 'PUT', url: `${BASE}/api/v1/class-sessions/1` });
  });

  test('AlertService.resolve sigue usando PUT', async () => {
    mockResponse({});

    await AlertService.resolve(4);
    expect(lastCall()).toMatchObject({ method: 'PUT', url: `${BASE}/api/v1/alerts/4` });
  });

  // El PUT con llaves snake era un no-op en 07 (zod las descarta): aprobar va por /review.
  test('BiometricCaseService.approve usa el PATCH de revisión', async () => {
    mockResponse({ caseId: 'c-1', updateStatus: 'Approved' });

    await BiometricCaseService.approve('c-1', 'u-1');
    expect(lastCall()).toMatchObject({
      method: 'PATCH',
      url: `${BASE}/api/v1/biometric-update-cases/c-1/review`,
      body: { updateStatus: 'Approved', reviewedBy: 'u-1' },
    });
  });

  test('BiometricCaseService.requestFacialUpdate envía el cuerpo camelCase', async () => {
    mockResponse({ caseId: 'c-2', personId: 'p-1', updateStatus: 'Pending' });

    const created = await BiometricCaseService.requestFacialUpdate('p-1', 'Cambio de apariencia');
    expect(lastCall()).toMatchObject({
      method: 'POST',
      url: `${BASE}/api/v1/biometric-update-cases`,
      body: { personId: 'p-1', biometricType: 'FACIAL', reason: 'Cambio de apariencia' },
    });
    expect(created).toMatchObject({ caseId: 'c-2', updateStatus: 'Pending' });
  });

  test('CourseService.getByProgram sigue usando el filtro legacy por query', async () => {
    mockResponse([]);

    await CourseService.getByProgram(7);

    expect(lastCall()).toMatchObject({ method: 'GET', url: `${BASE}/api/v1/courses?program_id=7` });
  });

  test('ActorService.getBySchool sigue usando la ruta anidada', async () => {
    mockResponse([]);

    await ActorService.getBySchool(3);

    expect(lastCall()).toMatchObject({ method: 'GET', url: `${BASE}/api/v1/schools/3/actors` });
  });

  test('ActorService.getByPerson filtra por personId en el servidor (el listado se corta en 100)', async () => {
    mockResponse([{ academicActorId: 1602, personId: 'p-9', actorTypeId: 2 }]);

    const actors = await ActorService.getByPerson('p-9');

    expect(lastCall()).toMatchObject({ method: 'GET', url: `${BASE}/api/v1/academic-actors?personId=p-9` });
    expect(actors.map((a) => a.academicActorId)).toEqual([1602]);
  });

  test('SessionService.getByUserId sigue usando el filtro legacy por query', async () => {
    mockResponse([]);

    await SessionService.getByUserId('u-1');

    expect(lastCall()).toMatchObject({ method: 'GET', url: `${BASE}/api/v1/sessions?user_id=u-1` });
  });
});
