/**
 * @fileOverview Legacy Activity Strangler Bridge (Phase 2 Milestone 2)
 *
 * Implements Rule 1 (Preserve Pre-existing Functionality), Rule 4 (Strict Typing),
 * Rule 60 (Emergency Dead-Man Controls), Rule 64 (Three-Tier Feature Flags),
 * and Rule 69 (Compatibility & Non-Distortion).
 *
 * Wraps legacy activity logging calls from src/lib/activity-logger.ts and
 * translates them into canonical DomainEvents for the reactive EventBus,
 * without disrupting legacy Firestore logging or triggerAutomationProtocols.
 */

import type { Activity } from '@/lib/types';
import { createDomainEvent, type DomainEvent, type EventActor } from '@/platform/capabilities/events/domain-event';
import { defaultEventBus } from '@/platform/events/event-bus';
import { checkEventDeadManSwitch } from '@/platform/events/resilience/event-dead-man';
import { checkEventFlag } from '@/platform/events/flags/event-flags';

type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

const LEGACY_EVENT_TYPE_MAP: Record<string, string> = {
  contact_created: 'crm.contact.created',
  contact_updated: 'crm.contact.updated',
  contact_deleted: 'crm.contact.deleted',
  contact_tagged: 'crm.contact.tagged',
  contact_untagged: 'crm.contact.untagged',
  note_added: 'crm.contact.note_added',
  deal_created: 'deal.created',
  deal_updated: 'deal.updated',
  deal_stage_changed: 'deal.stage_changed',
  deal_won: 'deal.won',
  deal_lost: 'deal.lost',
  task_created: 'task.created',
  task_completed: 'task.completed',
  task_updated: 'task.updated',
  portal_access_granted: 'portal.membership.subscribed',
  portal_access_revoked: 'portal.membership.cancelled',
};

/**
 * Maps a legacy activity type string to a canonical domain event type.
 */
export function mapLegacyTypeToDomainEventType(legacyType: string): string {
  if (LEGACY_EVENT_TYPE_MAP[legacyType]) {
    return LEGACY_EVENT_TYPE_MAP[legacyType]!;
  }
  // If it already follows domain.entity.action format, preserve it
  if (legacyType.includes('.')) {
    return legacyType;
  }
  return `legacy.${legacyType}`;
}

/**
 * Derives an EventActor from legacy activity fields.
 */
function deriveActorFromLegacy(legacyData: LogActivityInput): EventActor {
  if (legacyData.metadata?.isAutomation) {
    return {
      type: 'automation',
      id: legacyData.userId || 'automation-engine',
    };
  }

  if (legacyData.source === 'system') {
    return {
      type: 'system',
      id: legacyData.userId || 'system',
    };
  }

  return {
    type: 'user',
    id: legacyData.userId || 'user-unknown',
  };
}

/**
 * Converts legacy LogActivityInput into a validated canonical DomainEvent.
 */
export function convertLegacyActivityToDomainEvent(legacyData: LogActivityInput): DomainEvent {
  const eventType = mapLegacyTypeToDomainEventType(legacyData.type);
  const actor = deriveActorFromLegacy(legacyData);

  const entityType = legacyData.entityType ? String(legacyData.entityType) : 'Contact';
  const entityId = legacyData.entityId || legacyData.dealId || 'unspecified';
  const entityName = legacyData.displayName || legacyData.entityName || undefined;

  const correlationId =
    typeof legacyData.metadata?.correlationId === 'string'
      ? legacyData.metadata.correlationId
      : crypto.randomUUID();

  return createDomainEvent({
    type: eventType,
    organizationId: legacyData.organizationId,
    workspaceId: legacyData.workspaceId ?? null,
    actor,
    entity: {
      type: entityType,
      id: entityId,
    },
    payload: {
      name: entityName,
      description: legacyData.description,
      ...(legacyData.metadata || {}),
    },
    correlationId,
    causationId: typeof legacyData.metadata?.causationId === 'string' ? legacyData.metadata.causationId : undefined,
    source: 'legacy-activity-logger',
  });
}

/**
 * Bridges a legacy activity into the EventBus in a non-blocking, fail-open manner.
 * Guarantees zero disruption to the caller (Rule 69).
 */
export async function bridgeLegacyActivityToEventBackbone(
  legacyData: LogActivityInput
): Promise<void> {
  try {
    // 1. Check emergency dead-man switch (Rule 60)
    await checkEventDeadManSwitch();

    // 2. Check feature flag (Rule 64)
    const isEnabled = await checkEventFlag('enable_event_backbone', {
      organizationId: legacyData.organizationId,
      workspaceId: legacyData.workspaceId,
    });
    if (!isEnabled) {
      return;
    }

    // 3. Convert and publish
    const domainEvent = convertLegacyActivityToDomainEvent(legacyData);
    await defaultEventBus.publish(domainEvent);
  } catch (err: unknown) {
    // Non-blocking fail-open (Rule 69): legacy logging must never be interrupted
    console.warn('[STRANGLER-BRIDGE] Non-blocking bridge failure:', err);
  }
}
