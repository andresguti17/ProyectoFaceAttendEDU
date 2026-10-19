export interface AcademicPeriod {
  academicPeriodId: number;
  schoolId: number;
  name: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
