import { PostgresAcademicConfigurationRepository } from './academic-configuration.repository';
import { PostgresBiometricUpdateCaseRepository } from './biometric-update-case.repository';
import { PostgresSecurityConfigurationRepository } from './security-configuration.repository';

export interface ConfigurationRepositories {
  readonly academic: PostgresAcademicConfigurationRepository;
  readonly security: PostgresSecurityConfigurationRepository;
  readonly cases: PostgresBiometricUpdateCaseRepository;
}

export function createConfigurationRepositories(): ConfigurationRepositories {
  return {
    academic: new PostgresAcademicConfigurationRepository(),
    security: new PostgresSecurityConfigurationRepository(),
    cases: new PostgresBiometricUpdateCaseRepository(),
  };
}
