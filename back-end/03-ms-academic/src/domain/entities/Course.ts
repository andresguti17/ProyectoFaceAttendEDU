export interface Course {
  courseId: number;
  programId: number;
  code: string;
  name: string;
  creditHours: number;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
