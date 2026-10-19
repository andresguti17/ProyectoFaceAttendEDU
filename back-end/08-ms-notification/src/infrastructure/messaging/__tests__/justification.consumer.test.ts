import {
  handleJustificationReviewed,
  InvalidJustificationEventError,
  type JustificationReviewed,
} from '../justification.consumer';

function fakeRepos(existing: any[] = []) {
  const alerts = {
    rows: [...existing],
    async findByActorAndType(actorId: number, typeId: number) {
      return this.rows.filter((r: any) => r.academicActorId === actorId && r.alertTypeId === typeId);
    },
    async create(draft: any) {
      const row = { alertId: this.rows.length + 1, ...draft };
      this.rows.push(row);
      return row;
    },
  };
  const alertTypes = {
    async findByCode(code: string) {
      return code === 'JUSTIFICATION_APPROVED'
        ? { alertTypeId: 1, code }
        : code === 'JUSTIFICATION_REJECTED'
          ? { alertTypeId: 2, code }
          : null;
    },
  };
  return { alerts: alerts as any, alertTypes: alertTypes as any };
}

const baseEvent: JustificationReviewed = {
  eventType: 'JustificationReviewed',
  justificationId: 1,
  academicActorId: 10,
  status: 'Approved',
  reviewedAt: '2026-01-01T00:00:00.000Z',
};

describe('handleJustificationReviewed', () => {
  it('ignores an event that is not JustificationReviewed', async () => {
    const repos = fakeRepos();
    await handleJustificationReviewed(repos, { ...baseEvent, eventType: 'JustificationSubmitted' });
    expect(repos.alerts.rows).toHaveLength(0);
  });

  it('creates a DASHBOARD alert for Approved', async () => {
    const repos = fakeRepos();
    await handleJustificationReviewed(repos, baseEvent);
    expect(repos.alerts.rows).toHaveLength(1);
    expect(repos.alerts.rows[0].alertTypeId).toBe(1);
  });

  it('is idempotent on actor+type+raisedAt==reviewedAt for a redelivered event', async () => {
    const repos = fakeRepos([{ alertId: 1, academicActorId: 10, alertTypeId: 1, raisedAt: '2026-01-01T00:00:00.000Z' }]);
    await handleJustificationReviewed(repos, baseEvent);
    expect(repos.alerts.rows).toHaveLength(1);
  });

  it('throws InvalidJustificationEventError for an unknown status', async () => {
    const repos = fakeRepos();
    await expect(handleJustificationReviewed(repos, { ...baseEvent, status: 'Pending' })).rejects.toBeInstanceOf(InvalidJustificationEventError);
  });

  it('throws InvalidJustificationEventError for a zero actor id', async () => {
    await expect(handleJustificationReviewed(fakeRepos(), { ...baseEvent, academicActorId: 0 })).rejects.toBeInstanceOf(InvalidJustificationEventError);
  });
});
