import type { EntityType } from '../types';

export interface ExecutionContext {
  entityId?: string;
  entityType?: EntityType;
  workspaceId: string;
  /** Populated once at run start in executor.ts to avoid repeated Firestore reads per action step. */
  organizationId?: string;
  payload: Record<string, unknown>;
  automationId: string;
  runId: string;
  chainDepth?: number;
}

export const MAX_AUTOMATION_CHAIN_DEPTH = 5;
