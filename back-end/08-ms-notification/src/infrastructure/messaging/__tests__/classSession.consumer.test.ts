import { backoffMs, processClassSessionMessage } from '../classSession.consumer';
import { msUntilNextRun, riskHourFromEnv } from '../../scheduler/riskScheduler';
import type { AlertDeps } from '../../../application/attendanceAlerts/deps';

function depsFailing(times: number) {
  let calls = 0;
  const peers = {
    getSession: jest.fn(async () => {
      calls += 1;
      if (calls <= times) throw new Error('scheduling down');
      return null; // a session that is not closed: nothing to do, handler resolves
    }),
  };
  const warn = jest.fn();
  const deps = { peers, logger: { info: jest.fn(), warn } } as unknown as AlertDeps;
  return { deps, peers, warn };
}

const event = JSON.stringify({ eventType: 'ClassSessionClosed', classSessionId: 7, scheduleBlockId: 1, sessionDate: '2026-10-20', closedAt: '2026-10-20T10:00:00Z' });

describe('processClassSessionMessage', () => {
  it('retries a failing message with backoff until it succeeds', async () => {
    const { deps, peers } = depsFailing(2);
    const waits: number[] = [];

    await processClassSessionMessage(deps, event, '5', async (ms) => { waits.push(ms); });

    expect(peers.getSession).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([backoffMs(0), backoffMs(1)]);
  });

  it('skips a message that is not JSON', async () => {
    const { deps, peers, warn } = depsFailing(0);

    await processClassSessionMessage(deps, 'not json', '1', async () => undefined);

    expect(peers.getSession).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('skips an event with an invalid session id instead of retrying forever', async () => {
    const { deps, peers } = depsFailing(0);

    await processClassSessionMessage(deps, JSON.stringify({ eventType: 'ClassSessionClosed', classSessionId: 0 }), '2', async () => undefined);

    expect(peers.getSession).not.toHaveBeenCalled();
  });

  it('caps the backoff', () => {
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(9)).toBe(30_000);
  });
});

describe('risk scheduler timing', () => {
  it('runs later today when the hour has not passed', () => {
    const now = new Date(2026, 9, 21, 5, 30, 0);
    expect(msUntilNextRun(now, 7)).toBe(90 * 60 * 1000);
  });

  it('runs tomorrow when the hour has passed', () => {
    const now = new Date(2026, 9, 21, 8, 0, 0);
    expect(msUntilNextRun(now, 7)).toBe(23 * 60 * 60 * 1000);
  });

  it('reads the hour from the environment, ignoring invalid values', () => {
    expect(riskHourFromEnv({ RISK_ALERT_HOUR: '18' })).toBe(18);
    expect(riskHourFromEnv({ RISK_ALERT_HOUR: '25' })).toBe(7);
    expect(riskHourFromEnv({})).toBe(7);
  });
});
