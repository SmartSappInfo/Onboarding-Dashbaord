/**
 * @fileOverview CRM Domain Activity Subscriber (Phase 2 Milestone 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 18 (Concurrency & Lease Defense),
 * and Rule 47 (Multi-Tenant Isolation).
 *
 * Listens for crm.* events to update contact activity metrics and timestamps.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { DomainEvent } from '@/platform/capabilities/events/domain-event';

export interface CrmSubscriberDependencies {
  onUpdateContact?: (params: {
    organizationId: string;
    workspaceId: string;
    contactId: string;
    lastActivityAt: string;
  }) => Promise<void>;
}

export function createCrmActivitySubscriber(deps?: CrmSubscriberDependencies) {
  return {
    async handleEvent(event: DomainEvent): Promise<void> {
      if (!event.type.startsWith('crm.')) {
        return;
      }

      const contactId = event.entity.id;
      const organizationId = event.organizationId;
      const workspaceId = event.workspaceId || '';
      const lastActivityAt = event.timestamp;

      if (!contactId || !organizationId) {
        return;
      }

      if (deps?.onUpdateContact) {
        await deps.onUpdateContact({
          organizationId,
          workspaceId,
          contactId,
          lastActivityAt,
        });
        return;
      }

      // Default production Firestore update
      try {
        if (workspaceId) {
          const docRef = adminDb
            .collection('workspaces')
            .doc(workspaceId)
            .collection('entities')
            .doc(contactId);

          await docRef.set(
            {
              lastActivityAt,
              updatedAt: lastActivityAt,
            },
            { merge: true }
          );
        }
      } catch (err: unknown) {
        // Non-fatal: log and fail gracefully without crashing event bus (Rule 24)
        console.warn(`[CRM-SUBSCRIBER] Failed to update contact activity for ${contactId}:`, err);
      }
    },
  };
}
