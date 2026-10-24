import {
  EXPO_PUSH_URL,
  pushConfigFromEnv,
  pushText,
  sendAlertPush,
  withAlertPush,
  type PushDeps,
} from '../infrastructure/push/expoPush';

function tokenRepo(devices: Array<{ token: string; locale: string }>) {
  return {
    upsert: jest.fn(),
    revokeOwned: jest.fn(),
    findActiveByActor: jest.fn(async () => devices),
    revokeTokens: jest.fn(async () => undefined),
  };
}

const logger = () => ({ warn: jest.fn(), error: jest.fn() });

/** fetch answering one ok ticket per message, unless `tickets` decides otherwise. */
function expoFetch(tickets?: (messages: any[]) => any[]) {
  return jest.fn(async (_url: any, init: any) => {
    const messages = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: tickets ? tickets(messages) : messages.map(() => ({ status: 'ok', id: 'x' })) }),
    } as any;
  });
}

function deps(devices: Array<{ token: string; locale: string }>, fetchMock: any, accessToken = ''): PushDeps & { tokens: any; logger: any } {
  return { tokens: tokenRepo(devices), config: { enabled: true, accessToken }, logger: logger(), fetch: fetchMock };
}

const alert = { alertId: 41, academicActorId: 3 };
const approved = { code: 'JUSTIFICATION_APPROVED', name: 'Justification approved' };

describe('pushText', () => {
  it('uses the device locale', () => {
    expect(pushText('ATTENDANCE_LOW', 'x', 'en').body).toBe('Your attendance is below the minimum. Urgent.');
    expect(pushText('ATTENDANCE_LOW', 'x', 'es').body).toBe('Tu asistencia está por debajo del mínimo. Urgente.');
    expect(pushText('ATTENDANCE_LOW', 'x', 'pt').title).toBe('Frequência baixa');
    expect(pushText('ATTENDANCE_LOW', 'x', 'fr').title).toBe('Assiduité insuffisante');
  });

  it('falls back to Spanish for an unknown locale', () => {
    expect(pushText('JUSTIFICATION_REJECTED', 'x', 'de')).toEqual(pushText('JUSTIFICATION_REJECTED', 'x', 'es'));
  });

  it('uses the alert type name and a generic body for an unknown code', () => {
    expect(pushText('SOMETHING_NEW', 'Something new', 'en')).toEqual({
      title: 'Something new',
      body: 'You have a new alert. Open the app to see it.',
    });
  });

  it('covers every catalogued code in every locale', () => {
    const codes = [
      'JUSTIFICATION_RESULT', 'JUSTIFICATION_PENDING', 'JUSTIFICATION_APPROVED', 'JUSTIFICATION_REJECTED',
      'ATTENDANCE_ABSENTEEISM', 'ATTENDANCE_TARDINESS', 'ATTENDANCE_LOW', 'BIOMETRIC_UPDATE',
    ];
    for (const code of codes) {
      for (const locale of ['es', 'en', 'pt', 'fr']) {
        expect(pushText(code, 'NAME', locale).title).not.toBe('NAME');
      }
    }
  });
});

describe('sendAlertPush', () => {
  it('sends one message per device with its locale text and data { alertId, code }', async () => {
    const fetchMock = expoFetch();
    const d = deps([{ token: 'ExponentPushToken[a]', locale: 'en' }, { token: 'ExponentPushToken[b]', locale: 'xx' }], fetchMock);
    await sendAlertPush(d, alert, approved);

    expect(d.tokens.findActiveByActor).toHaveBeenCalledWith(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(EXPO_PUSH_URL);
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual([
      { to: 'ExponentPushToken[a]', sound: 'default', title: 'Justification approved', body: 'Your justification was approved.', data: { alertId: 41, code: 'JUSTIFICATION_APPROVED' } },
      { to: 'ExponentPushToken[b]', sound: 'default', title: 'Justificación aprobada', body: 'Tu justificación fue aprobada.', data: { alertId: 41, code: 'JUSTIFICATION_APPROVED' } },
    ]);
  });

  it('sends the bearer only when an access token is configured', async () => {
    const fetchMock = expoFetch();
    await sendAlertPush(deps([{ token: 'ExponentPushToken[a]', locale: 'es' }], fetchMock, 'secret'), alert, approved);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
  });

  it('splits more than 100 devices into chunks of 100', async () => {
    const devices = Array.from({ length: 250 }, (_, i) => ({ token: `ExponentPushToken[${i}]`, locale: 'es' }));
    const fetchMock = expoFetch();
    await sendAlertPush(deps(devices, fetchMock), alert, approved);
    expect(fetchMock.mock.calls.map((c: any[]) => JSON.parse(c[1].body).length)).toEqual([100, 100, 50]);
  });

  it('revokes tokens Expo reports as DeviceNotRegistered, across chunks', async () => {
    const devices = Array.from({ length: 101 }, (_, i) => ({ token: `ExponentPushToken[${i}]`, locale: 'es' }));
    const fetchMock = expoFetch((messages) =>
      messages.map((m) =>
        m.to === 'ExponentPushToken[1]' || m.to === 'ExponentPushToken[100]'
          ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
          : m.to === 'ExponentPushToken[2]'
            ? { status: 'error', details: { error: 'MessageRateExceeded' } }
            : { status: 'ok' },
      ),
    );
    const d = deps(devices, fetchMock);
    await sendAlertPush(d, alert, approved);
    expect(d.tokens.revokeTokens).toHaveBeenCalledWith(['ExponentPushToken[1]', 'ExponentPushToken[100]']);
    expect(d.logger.warn).toHaveBeenCalledWith(expect.objectContaining({ error: 'MessageRateExceeded' }), expect.any(String));
  });

  it('logs and carries on when a chunk fails, without throwing', async () => {
    const devices = Array.from({ length: 150 }, (_, i) => ({ token: `ExponentPushToken[${i}]`, locale: 'es' }));
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const d = deps(devices, fetchMock);
    await expect(sendAlertPush(d, alert, approved)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(d.logger.error).toHaveBeenCalledTimes(2);
    expect(d.tokens.revokeTokens).not.toHaveBeenCalled();
  });

  it('does nothing without devices or when disabled', async () => {
    const fetchMock = expoFetch();
    await sendAlertPush(deps([], fetchMock), alert, approved);
    const disabled = deps([{ token: 'ExponentPushToken[a]', locale: 'es' }], fetchMock);
    disabled.config.enabled = false;
    await sendAlertPush(disabled, alert, approved);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('withAlertPush', () => {
  const flush = () => new Promise((r) => setImmediate(r));

  function alertsRepo() {
    return {
      label: 'real',
      async create(draft: any) { return { alertId: 41, ...draft }; },
      async findById() { return null; },
      whoAmI() { return (this as any).label; },
    } as any;
  }

  it('returns the created alert and pushes it in the background with its alert type', async () => {
    const fetchMock = expoFetch();
    const d = deps([{ token: 'ExponentPushToken[a]', locale: 'es' }], fetchMock);
    const alertTypes = { findById: jest.fn(async () => approved) } as any;
    const repo = withAlertPush(alertsRepo(), alertTypes, d);

    const created = await repo.create({ academicActorId: 3, alertTypeId: 9, raisedAt: 'now', resolvedAt: null });
    expect(created.alertId).toBe(41);
    await flush();
    await flush();
    expect(alertTypes.findById).toHaveBeenCalledWith(9);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0].data).toEqual({ alertId: 41, code: 'JUSTIFICATION_APPROVED' });
  });

  it('keeps the other repository methods working on the real instance', () => {
    const repo = withAlertPush(alertsRepo(), {} as any, deps([], expoFetch())) as any;
    expect(repo.whoAmI()).toBe('real');
  });

  it('never fails alert creation when the push fails', async () => {
    const d = deps([], expoFetch());
    d.tokens.findActiveByActor.mockRejectedValue(new Error('db down'));
    const repo = withAlertPush(alertsRepo(), { findById: async () => approved } as any, d);
    await expect(repo.create({ academicActorId: 3, alertTypeId: 9, raisedAt: 'now', resolvedAt: null })).resolves.toMatchObject({ alertId: 41 });
    await flush();
    await flush();
    expect(d.logger.error).toHaveBeenCalledWith(expect.objectContaining({ alertId: 41 }), 'alert push failed');
  });
});

describe('pushConfigFromEnv', () => {
  it('is enabled by default and only PUSH_ENABLED=false turns it off', () => {
    expect(pushConfigFromEnv({})).toEqual({ enabled: true, accessToken: '' });
    expect(pushConfigFromEnv({ PUSH_ENABLED: 'FALSE', EXPO_PUSH_ACCESS_TOKEN: ' t ' })).toEqual({ enabled: false, accessToken: 't' });
  });
});
