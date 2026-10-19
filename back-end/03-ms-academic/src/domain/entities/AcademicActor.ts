export type ActorType = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
export interface AcademicActorRecord {
  academicActorId: number;
  personId: string;
  actorTypeId: number;
  actorTypeCode?: ActorType;
  schoolId: number;
  actorCode: string;
  startedOn: string;
  endedOn?: string | null;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
export class AcademicActor {
  constructor(public readonly academicActorId: number, public readonly personId: string, public readonly actorType: ActorType, public readonly schoolId: number) {}
  static create(personId: string, actorType: ActorType, schoolId: number) { return new AcademicActor(0, personId, actorType, schoolId); }
}
