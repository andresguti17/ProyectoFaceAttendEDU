import type { IIstqbAssessmentRepository } from '../../../domain/ports/out/IIstqbAssessmentRepository';
import type { IProcessAssessmentRepository } from '../../../domain/ports/out/IProcessAssessmentRepository';
import type { IQualityEvaluationRepository } from '../../../domain/ports/out/IQualityEvaluationRepository';
import type { IQualityProjectRepository } from '../../../domain/ports/out/IQualityProjectRepository';
import { PgIstqbAssessmentRepository } from './istqb-assessment.pg.repository';
import { PgProcessAssessmentRepository } from './process-assessment.pg.repository';
import { PgQualityEvaluationRepository } from './quality-evaluation.pg.repository';
import { PgQualityProjectRepository } from './quality-project.pg.repository';

export interface QualityRepositories {
  readonly evaluations: IQualityEvaluationRepository;
  readonly projects: IQualityProjectRepository;
  readonly processAssessments: IProcessAssessmentRepository;
  readonly istqbAssessments: IIstqbAssessmentRepository;
}

export function createQualityRepositories(): QualityRepositories {
  return {
    evaluations: new PgQualityEvaluationRepository(),
    projects: new PgQualityProjectRepository(),
    processAssessments: new PgProcessAssessmentRepository(),
    istqbAssessments: new PgIstqbAssessmentRepository(),
  };
}
