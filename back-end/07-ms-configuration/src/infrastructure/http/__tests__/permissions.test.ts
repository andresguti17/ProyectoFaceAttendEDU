import { configurationPermission } from '../permissions';

describe('configurationPermission', () => {
  it('gates every write with configuration:manage', () => {
    expect(configurationPermission('POST', '/api/v1/configurations/academic')).toBe('configuration:manage');
    expect(configurationPermission('PUT', '/api/v1/configurations/academic/1')).toBe('configuration:manage');
    expect(configurationPermission('DELETE', '/api/v1/configurations/security/1')).toBe('configuration:manage');
  });

  it('gates academic config reads too — a plain GET must not be free for any authenticated role', () => {
    expect(configurationPermission('GET', '/api/v1/configurations/academic')).toBe('configuration:manage');
    expect(configurationPermission('GET', '/api/v1/academic-configurations')).toBe('configuration:manage');
    expect(configurationPermission('GET', '/api/v1/schools/1/configurations')).toBe('configuration:manage');
  });

  it('gates security config reads too (unchanged behaviour)', () => {
    expect(configurationPermission('GET', '/api/v1/configurations/security')).toBe('configuration:manage');
  });

  it('leaves every other GET free of a specific permission (session alone suffices)', () => {
    expect(configurationPermission('GET', '/api/v1/some-other-resource')).toBeNull();
  });

  it('keeps biometric-case permissions independent of the academic/security gates', () => {
    expect(configurationPermission('GET', '/api/v1/biometric-update-cases')).toBe('biometric.case:request');
    expect(configurationPermission('POST', '/api/v1/biometric-update-cases')).toBe('biometric.case:request');
    expect(configurationPermission('PATCH', '/api/v1/biometric-update-cases/1/review')).toBe('biometric.case:review');
  });
});
