import type { Timestamp } from 'firebase-admin/firestore';

export type DuplicateStrategy = 
  | 'ADD_TAG_ONLY' 
  | 'UPDATE_FIELDS_AND_TAG' 
  | 'UPDATE_MISSING_FIELDS_AND_TAG'
  | 'SKIP' 
  | 'TRIGGER_AUTOMATION' 
  | 'MANUAL_CORRECTION';

export type ImportStatus = 'processing' | 'completed' | 'failed' | 'partially_completed';

export interface ImportLogDoc {
  id: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  filename: string;
  entityType: string;
  status: ImportStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  duplicateStrategy: DuplicateStrategy;
  selectedTags: string[];
  automationId?: string | null;
  startedAt: Timestamp | Date | any;
  completedAt?: Timestamp | Date | any | null;
  rawFieldsCleared: boolean;
}

export interface FailedRowDoc {
  id: string;
  importLogId: string;
  rowIdx: number;
  rawPayload: Record<string, any>;
  error: string;
  resolved: boolean;
  retryCount: number;
  createdAt: Timestamp | Date | any;
}
