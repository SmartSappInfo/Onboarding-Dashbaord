export interface MigrationProgressState {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  lastProcessedEntityId: string | null;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  errors: Array<{ entityId: string; error: string; timestamp: string }>;
  updatedAt: string;
}

export interface MigrationArgs {
  rollback: boolean;
  verify: boolean;
  resume: boolean;
}
