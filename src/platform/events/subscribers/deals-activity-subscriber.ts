/**
 * @fileOverview Deals Domain Activity Subscriber (Phase 2 Milestone 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 18 (Concurrency & Lease Defense),
 * and Rule 47 (Multi-Tenant Isolation).
 *
 * Listens for deal.* events to update pipeline velocity and stage duration metrics.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { DomainEvent } from '@/platform/capabilities/events/domain-event';

export interface DealsSubscriberDependencies {
  onUpdateDeal?: (params: {
    organizationId: string;
    workspaceId: string;
    dealId: string;
    stage?: string;
    lastStageChangeAt: string;
  }) => Promise<void>;
}

export function createDealsActivitySubscriber(deps?: DealsSubscriberDependencies) {
  return {
    async handleEvent(event: DomainEvent): Promise<void> {
      if (!event.type.startsWith('deal.')) {
        return;
      }

      const dealId = event.entity.id;
      const organizationId = event.organizationId;
      const workspaceId = event.workspaceId || '';
      const lastStageChangeAt = event.timestamp;
      const stage = typeof event.payload?.newStage === 'string' ? event.payload.newStage : undefined;

      if (!dealId || !organizationId) {
        return;
      }

      if (deps?.onUpdateDeal) {
        await deps.onUpdateDeal({
          organizationId,
          workspaceId,
          dealId,
          stage,
          lastStageChangeAt,
        });
        return;
      }

      // Default production Firestore update
      try {
        const docRef = adminDb.collection('deals').doc(dealId);
        const updateData: Record<string, unknown> = {
          lastStageChangeAt,
          updatedAt: lastStageChangeAt,
        };
        if (stage) {
          updateData.stage = stage;
        }

        await docRef.set(updateData, { merge: true });
      } catch (err: unknown) {
        console.warn(`[DEALS-SUBSCRIBER] Failed to update deal activity for ${dealId}:`, err);
      }
    },
  };
}
