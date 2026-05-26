import type { AutomationEventPayload, EntityType } from './types';

export interface BuildAutomationPayloadInput {
  organizationId: string;
  workspaceId: string;
  entityId?: string | null;
  entityType?: EntityType | null;
  action: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Standardizes automation trigger payloads (entity-first, no schoolId).
 */
export function buildAutomationPayload(
  input: BuildAutomationPayloadInput
): AutomationEventPayload {
  const { organizationId, workspaceId, entityId, entityType, action, actorId, metadata, ...rest } =
    input;

  return {
    organizationId,
    workspaceId,
    entityId: entityId || '',
    entityType: entityType || 'institution',
    action,
    actorId: actorId ?? null,
    timestamp: new Date().toISOString(),
    ...(metadata || {}),
    ...rest,
  };
}
