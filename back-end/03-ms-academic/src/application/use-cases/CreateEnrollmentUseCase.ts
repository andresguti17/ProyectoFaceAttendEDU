import { ICreateEnrollmentUseCase, CreateEnrollmentCommand } from '../../domain/ports/in/ICreateEnrollmentUseCase';
import { IEnrollmentRepository } from '../../domain/ports/out/IEnrollmentRepository';
import { Enrollment } from '../../domain/entities/Enrollment';
export class CreateEnrollmentUseCase implements ICreateEnrollmentUseCase {
  constructor(private readonly repo: IEnrollmentRepository) {}
  async execute(cmd: CreateEnrollmentCommand): Promise<number> {
    const e = Enrollment.create(cmd.academicActorId, cmd.cohortId);
    await this.repo.save(e);
    return e.enrollmentId;
  }
}
