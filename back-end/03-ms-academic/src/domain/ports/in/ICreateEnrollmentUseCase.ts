export interface CreateEnrollmentCommand { academicActorId: number; cohortId: number; }
export interface ICreateEnrollmentUseCase { execute(cmd: CreateEnrollmentCommand): Promise<number>; }
