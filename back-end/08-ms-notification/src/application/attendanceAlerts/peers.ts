/**
 * What the attendance alerts need to know from the other services — 08-ms-notification.
 *
 * The use cases only see this interface; `infrastructure/peers/httpPeers.ts` implements it over
 * HTTP with a service account, and the tests implement it in memory.
 */
export interface SessionInfo {
  classSessionId: number;
  scheduleBlockId: number;
  sessionDate: string;
  sessionStatus: string;
}

export interface BlockInfo {
  scheduleBlockId: number;
  cohortId: number;
  courseId: number;
  instructorActorId: number;
  environmentId: number;
  startsAt: string;
}

export interface ActorInfo {
  academicActorId: number;
  personId: string;
  actorTypeId: number;
  schoolId: number;
  status: boolean;
}

export interface PersonInfo {
  personId: string;
  name: string;
  lastName: string;
  email: string | null;
}

export interface AttendanceCounts {
  present: number;
  late: number;
  absent: number;
  justified: number;
  total: number;
}

/** `academic_actor_type`: 1 = STUDENT, 2 = INSTRUCTOR, 3 = ADMIN (administrador de sede). */
export const ACTOR_TYPE_STUDENT = 1;
export const ACTOR_TYPE_ADMIN = 3;

export interface Peers {
  getSession(sessionId: number): Promise<SessionInfo | null>;
  getBlock(blockId: number): Promise<BlockInfo | null>;
  /** School of the environment (room) where the block is taught. */
  getEnvironmentSchoolId(environmentId: number): Promise<number | null>;
  /** Actors with an active enrollment in the cohort. */
  getCohortActorIds(cohortId: number): Promise<number[]>;
  /** Cohorts the actor is actively enrolled in. */
  getActorCohortIds(actorId: number): Promise<number[]>;
  /** Instructors teaching the cohort, from its schedule blocks. */
  getCohortInstructorIds(cohortId: number): Promise<number[]>;
  /** Actors that already have a record in the session, whatever its status. */
  getSessionRecordedActorIds(sessionId: number): Promise<number[]>;
  /** Records `Absent` for the actor; `exists` when the session already had a record for it. */
  createAbsentRecord(sessionId: number, actorId: number): Promise<'created' | 'exists'>;
  getActor(actorId: number): Promise<ActorInfo | null>;
  getPerson(personId: string): Promise<PersonInfo | null>;
  getSchoolActors(schoolId: number): Promise<ActorInfo[]>;
  /** `configuration_name -> configuration_value` of the school. */
  getSchoolSettings(schoolId: number): Promise<Record<string, string>>;
  getCourseName(courseId: number): Promise<string>;
  getCohortCode(cohortId: number): Promise<string>;
  listSchools(): Promise<Array<{ schoolId: number; name: string }>>;
  getAttendanceCounts(actorIds: number[]): Promise<Map<number, AttendanceCounts>>;
}
