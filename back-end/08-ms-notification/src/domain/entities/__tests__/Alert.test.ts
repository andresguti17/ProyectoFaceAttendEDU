import { validateAlertDraft } from '../Alert';
import { validateAlertTypeDraft, ALERT_TYPE_CHANNELS } from '../AlertType';

describe('validateAlertDraft', () => {
  it('requires academicActorId', () => {
    expect(validateAlertDraft({ alertTypeId: 1 })).toBe('academic_actor_id is required');
  });
  it('requires alertTypeId', () => {
    expect(validateAlertDraft({ academicActorId: 1 })).toBe('alert_type_id is required');
  });
  it('accepts a valid draft', () => {
    expect(validateAlertDraft({ academicActorId: 1, alertTypeId: 2 })).toBeNull();
  });
});

describe('validateAlertTypeDraft', () => {
  it('requires code, name, severity', () => {
    expect(validateAlertTypeDraft({})).toBe('code is required');
    expect(validateAlertTypeDraft({ code: 'X' })).toBe('name is required');
    expect(validateAlertTypeDraft({ code: 'X', name: 'Y' })).toBe('severity is required');
  });
  it('rejects a channel outside DASHBOARD/EMAIL/PUSH', () => {
    const d = { code: 'X', name: 'Y', severity: 'WARNING', channel: 'SMS' };
    expect(validateAlertTypeDraft(d)).toBe('channel must be one of DASHBOARD, EMAIL, PUSH');
  });
  it('accepts an empty channel', () => {
    expect(validateAlertTypeDraft({ code: 'X', name: 'Y', severity: 'WARNING', channel: '' })).toBeNull();
  });
  it('exposes the allowed channels', () => {
    expect(ALERT_TYPE_CHANNELS).toEqual(['DASHBOARD', 'EMAIL', 'PUSH']);
  });
});
