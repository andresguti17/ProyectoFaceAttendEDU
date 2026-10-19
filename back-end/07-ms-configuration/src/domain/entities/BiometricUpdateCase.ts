export type BiometricType = 'FACIAL' | 'FINGERPRINT';
export type UpdateStatus = 'Pending' | 'In_Review' | 'Approved' | 'Rejected';

export interface BiometricUpdateCase {
  caseId: string;
  personId: string;
  biometricType: BiometricType;
  fingerNumber?: number | null;
  currentEmbeddingRef?: string | null;
  reason: string;
  updateStatus: UpdateStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
