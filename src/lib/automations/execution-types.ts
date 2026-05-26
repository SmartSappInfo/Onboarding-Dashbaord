import type { EntityType } from '../types';

export interface ExecutionContext {
  entityId?: string;
  entityType?: EntityType;
  workspaceId: string;
  payload: Record<string, unknown>;
  automationId: string;
  runId: string;
  chainDepth?: number;
}

export const MAX_AUTOMATION_CHAIN_DEPTH = 5;
