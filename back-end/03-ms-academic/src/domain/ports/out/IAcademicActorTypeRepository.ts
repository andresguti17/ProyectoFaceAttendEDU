import type { AcademicActorType } from '../../entities/AcademicActorType';
import type { ICrudRepository, Draft } from './ICrudRepository';

export type AcademicActorTypeDraft = Draft<AcademicActorType, 'actorTypeId'>;

/**
 * `academic.academic_actor_type` — catálogo STUDENT / INSTRUCTOR.
 * Liquibase seeds rows 1=STUDENT and 2=INSTRUCTOR; the service must not re-seed.
 */
export interface IAcademicActorTypeRepository
  extends ICrudRepository<AcademicActorType, number, AcademicActorTypeDraft> {
  /**
   * Revive una fila borrada lógicamente con ese code. UNIQUE (code) incluye las
   * borradas, así que sin esto un code retirado quedaba bloqueado para siempre:
   * no se podía volver a crear (409) ni se veía en los listados.
   */
  restoreByCode(code: string, name: string): Promise<AcademicActorType | null>;
}
