import type { Timestamp } from 'firebase-admin/firestore';

export type DuplicateStrategy = 
  | 'ADD_TAG_ONLY' 
  | 'UPDATE_FIELDS_AND_TAG' 
  | 'UPDATE_MISSING_FIELDS_AND_TAG'
  | 'KEEP_AND_MERGE'
  | 'REPLACE_AND_MERGE'
  | 'SKIP' 
  | 'TRIGGER_AUTOMATION' 
  | 'MANUAL_CORRECTION'
  | 'CREATE_NEW';

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

export interface DealImportConfig {
  pipelineId: string;
  stageId: string;
  nameTemplate: string;
  value: number;
  suppressAutomations: boolean;
}

export function isDealImportConfig(val: unknown): val is DealImportConfig {
  return (
    typeof val === 'object' && val !== null &&
    typeof (val as any).pipelineId === 'string' &&
    typeof (val as any).stageId === 'string' &&
    typeof (val as any).nameTemplate === 'string'
  );
}

