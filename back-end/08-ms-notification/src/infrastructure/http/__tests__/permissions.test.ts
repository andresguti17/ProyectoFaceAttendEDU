import { notificationPermission } from '../permissions';

describe('notificationPermission', () => {
  it('requires configuration:manage for quality routes', () => {
    expect(notificationPermission('GET', '/api/v1/quality/report')).toBe('configuration:manage');
  });
  it('requires notification.alert:read for any other GET', () => {
    expect(notificationPermission('GET', '/api/v1/alerts')).toBe('notification.alert:read');
    expect(notificationPermission('GET', '/api/v1/alert-types/1')).toBe('notification.alert:read');
  });
  it('requires attendance.record:write to resolve an alert', () => {
    expect(notificationPermission('PATCH', '/api/v1/alerts/5/resolve')).toBe('attendance.record:write');
  });
  it('requires configuration:manage for every other write', () => {
    expect(notificationPermission('POST', '/api/v1/alerts')).toBe('configuration:manage');
    expect(notificationPermission('DELETE', '/api/v1/alerts/5')).toBe('configuration:manage');
    expect(notificationPermission('PUT', '/api/v1/alert-types/1')).toBe('configuration:manage');
  });
});
