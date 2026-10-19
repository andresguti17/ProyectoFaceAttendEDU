export interface Program {
  programId: number;
  schoolId: number;
  code: string;
  name: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
