export interface Cohort {
  cohortId: number;
  programId: number;
  academicPeriodId: number;
  code: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
