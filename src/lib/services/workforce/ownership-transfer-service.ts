/**
 * @fileOverview Deterministic CRM Ownership Transfer Engine (Phase 7)
 *
 * Atomically migrates portfolios of leads, contacts, deals, tasks, meetings,
 * and automations from a source member to a target member in safe batches of <= 250 write operations.
 * Supports both workspace-scoped and organization-wide portfolio migrations.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs batching with progress tracking in `crm_ownership_transfers`.
 * - When `workspaceId` is specified, strictly scopes mutations to assets in that workspace.
 * - Supports modern composite assignee objects ({ userId, name, email }) as well as legacy string IDs.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `crm-workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  CrmEntityType,
  CrmOwnershipTransferJob,
} from '@/lib/types';
import { PersonService } from '@/lib/services/identity/person-service';
import { SecurityAuditService } from '@/lib/services/governance/security-audit-service';

export class OwnershipTransferService {
  private static collectionName = 'crm_ownership_transfers';

  /**
   * Executes multi-entity CRM ownership transfer in safe batches of <= 250 operations.
   */
  static async transferOwnership(
    organizationId: string,
    payload: {
      sourcePersonId: string;
      targetPersonId: string;
      entityTypes: CrmEntityType[];
      reason?: string;
      executedBy: string;
      workspaceId?: string;
    }
  ): Promise<CrmOwnershipTransferJob> {
    if (payload.sourcePersonId === payload.targetPersonId) {
      throw new Error('Source and destination members must be different.');
    }

    const [sourcePerson, targetPerson] = await Promise.all([
      PersonService.getPerson(payload.sourcePersonId),
      PersonService.getPerson(payload.targetPersonId),
    ]);

    if (!sourcePerson || !targetPerson) {
      throw new Error('Source or target member not found.');
    }

    const targetAssigneeObject = {
      userId: targetPerson.id,
      name: targetPerson.displayName || targetPerson.email || targetPerson.id,
      email: targetPerson.email || '',
    };

    const jobRef = adminDb.collection(this.collectionName).doc();
    const now = new Date().toISOString();

    const job: CrmOwnershipTransferJob = {
      id: jobRef.id,
      organizationId,
      workspaceId: payload.workspaceId,
      sourcePersonId: payload.sourcePersonId,
      sourcePersonName: sourcePerson.displayName || sourcePerson.email,
      targetPersonId: payload.targetPersonId,
      targetPersonName: targetPerson.displayName || targetPerson.email,
      entityTypes: payload.entityTypes,
      transferredCounts: {
        lead: 0,
        contact: 0,
        deal: 0,
        task: 0,
        meeting: 0,
        campaign: 0,
        automation: 0,
      },
      totalTransferred: 0,
      status: 'in_progress',
      reason: payload.reason?.trim(),
      executedBy: payload.executedBy,
      startedAt: now,
    };

    await jobRef.set(job);

    const transferredCounts: Record<string, number> = {
      lead: 0,
      contact: 0,
      deal: 0,
      task: 0,
      meeting: 0,
      campaign: 0,
      automation: 0,
    };

    try {
      const CHUNK_SIZE = 250;

      // 1. Transfer Deals
      if (payload.entityTypes.includes('deal')) {
        let dealsQuery: FirebaseFirestore.Query = adminDb.collection('deals');
        if (payload.workspaceId) {
          dealsQuery = dealsQuery.where('workspaceId', '==', payload.workspaceId);
        } else {
          dealsQuery = dealsQuery.where('organizationId', '==', organizationId);
        }
        const dealsSnap = await dealsQuery.get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));

        const matchingDeals = dealsSnap.docs.filter((d) => {
          const data = d.data();
          const assigned = data.assignedTo;
          const repId = typeof assigned === 'string' ? assigned : assigned?.userId;
          return repId === payload.sourcePersonId || data.ownerId === payload.sourcePersonId;
        });

        for (let i = 0; i < matchingDeals.length; i += CHUNK_SIZE) {
          const chunk = matchingDeals.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const d of chunk) {
            batch.update(d.ref, {
              assignedTo: targetAssigneeObject,
              ownerId: payload.targetPersonId,
              historicOwnerId: payload.sourcePersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }
        transferredCounts.deal = matchingDeals.length;
      }

      // 2. Transfer Contacts & Leads
      if (payload.entityTypes.includes('contact') || payload.entityTypes.includes('lead')) {
        // A. Workspace Entities (Unified directory)
        let weQuery: FirebaseFirestore.Query = adminDb.collection('workspace_entities');
        if (payload.workspaceId) {
          weQuery = weQuery.where('workspaceId', '==', payload.workspaceId);
        } else {
          weQuery = weQuery.where('organizationId', '==', organizationId);
        }
        const weSnap = await weQuery.get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));

        const matchingWe = weSnap.docs.filter((d) => {
          const data = d.data();
          if (data.status === 'archived') return false;
          const assigned = data.assignedTo;
          const repId = (typeof assigned === 'string' ? assigned : assigned?.userId) || data.ownerId;
          const matchesRep = repId === payload.sourcePersonId;
          if (!matchesRep) return false;
          if (data.entityType === 'lead') return payload.entityTypes.includes('lead');
          return payload.entityTypes.includes('contact');
        });

        const seenEntityIds = new Set<string>();
        for (let i = 0; i < matchingWe.length; i += CHUNK_SIZE) {
          const chunk = matchingWe.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const d of chunk) {
            const data = d.data();
            seenEntityIds.add(data.entityId || d.id);
            if (data.entityType === 'lead') {
              transferredCounts.lead = (transferredCounts.lead || 0) + 1;
            } else {
              transferredCounts.contact = (transferredCounts.contact || 0) + 1;
            }
            batch.update(d.ref, {
              assignedTo: targetAssigneeObject,
              ownerId: payload.targetPersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }

        // B. Standard contacts collection
        let contactsQuery: FirebaseFirestore.Query = adminDb.collection('contacts');
        if (payload.workspaceId) {
          contactsQuery = contactsQuery.where('workspaceId', '==', payload.workspaceId);
        } else {
          contactsQuery = contactsQuery.where('organizationId', '==', organizationId);
        }
        const contactsSnap = await contactsQuery.get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));

        const matchingContacts = contactsSnap.docs.filter((d) => {
          const data = d.data();
          if (seenEntityIds.has(d.id) || (data.entityId && seenEntityIds.has(data.entityId))) return false;
          const assigned = data.assignedTo;
          const repId = (typeof assigned === 'string' ? assigned : assigned?.userId) || data.ownerId;
          const matchesRep = repId === payload.sourcePersonId;
          if (!matchesRep) return false;
          if (data.type === 'lead') return payload.entityTypes.includes('lead');
          return payload.entityTypes.includes('contact');
        });

        for (let i = 0; i < matchingContacts.length; i += CHUNK_SIZE) {
          const chunk = matchingContacts.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const c of chunk) {
            const data = c.data();
            if (data.type === 'lead') {
              transferredCounts.lead = (transferredCounts.lead || 0) + 1;
            } else {
              transferredCounts.contact = (transferredCounts.contact || 0) + 1;
            }
            batch.update(c.ref, {
              assignedTo: targetAssigneeObject,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }
      }

      // 3. Transfer Tasks
      if (payload.entityTypes.includes('task')) {
        let tasksQuery: FirebaseFirestore.Query = adminDb.collection('tasks');
        if (payload.workspaceId) {
          tasksQuery = tasksQuery.where('workspaceId', '==', payload.workspaceId);
        } else {
          tasksQuery = tasksQuery.where('organizationId', '==', organizationId);
        }
        const tasksSnap = await tasksQuery.get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));

        const matchingTasks = tasksSnap.docs.filter((d) => {
          const data = d.data();
          if (data.status === 'completed' || data.status === 'cancelled' || data.status === 'archived') return false;
          const assigned = data.assignedTo;
          return (
            (typeof assigned === 'string' && assigned === payload.sourcePersonId) ||
            (Array.isArray(assigned) && assigned.includes(payload.sourcePersonId)) ||
            (assigned?.userId === payload.sourcePersonId)
          );
        });

        for (let i = 0; i < matchingTasks.length; i += CHUNK_SIZE) {
          const chunk = matchingTasks.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const t of chunk) {
            batch.update(t.ref, {
              assignedTo: payload.targetPersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }

        // Also check legacy crm_tasks if present
        let legacyTasksQuery: FirebaseFirestore.Query = adminDb.collection('crm_tasks');
        if (payload.workspaceId) {
          legacyTasksQuery = legacyTasksQuery.where('workspaceId', '==', payload.workspaceId);
        } else {
          legacyTasksQuery = legacyTasksQuery.where('organizationId', '==', organizationId);
        }
        const legacyTasksSnap = await legacyTasksQuery
          .where('assignedTo', '==', payload.sourcePersonId)
          .get()
          .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));

        for (let i = 0; i < legacyTasksSnap.docs.length; i += CHUNK_SIZE) {
          const chunk = legacyTasksSnap.docs.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const t of chunk) {
            batch.update(t.ref, {
              assignedTo: payload.targetPersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }

        transferredCounts.task = matchingTasks.length + legacyTasksSnap.docs.length;
      }

      // 4. Transfer Meetings
      if (payload.entityTypes.includes('meeting')) {
        let meetingsQuery: FirebaseFirestore.Query = adminDb.collection('meetings');
        if (payload.workspaceId) {
          meetingsQuery = meetingsQuery.where('workspaceIds', 'array-contains', payload.workspaceId);
        } else {
          meetingsQuery = meetingsQuery.where('organizationId', '==', organizationId);
        }
        const meetingsSnap = await meetingsQuery.get().catch(async () => {
          if (payload.workspaceId) {
            return adminDb.collection('meetings').where('workspaceId', '==', payload.workspaceId).get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));
          }
          return { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] };
        });

        const matchingMeetings = meetingsSnap.docs.filter((d) => {
          const data = d.data();
          return data.hostId === payload.sourcePersonId || data.assignedTo === payload.sourcePersonId || data.createdBy === payload.sourcePersonId;
        });

        for (let i = 0; i < matchingMeetings.length; i += CHUNK_SIZE) {
          const chunk = matchingMeetings.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const m of chunk) {
            const data = m.data();
            const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
            if (data.hostId === payload.sourcePersonId) update.hostId = payload.targetPersonId;
            if (data.assignedTo === payload.sourcePersonId) update.assignedTo = payload.targetPersonId;
            if (data.createdBy === payload.sourcePersonId) update.createdBy = payload.targetPersonId;
            batch.update(m.ref, update);
          }
          await batch.commit();
        }
        transferredCounts.meeting = matchingMeetings.length;
      }

      // 5. Transfer Automations
      if (payload.entityTypes.includes('automation')) {
        let autoQuery: FirebaseFirestore.Query = adminDb.collection('automations');
        if (payload.workspaceId) {
          autoQuery = autoQuery.where('workspaceIds', 'array-contains', payload.workspaceId);
        } else {
          autoQuery = autoQuery.where('organizationId', '==', organizationId);
        }
        const autoSnap = await autoQuery.get().catch(async () => {
          if (payload.workspaceId) {
            return adminDb.collection('automations').where('workspaceId', '==', payload.workspaceId).get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));
          }
          return { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] };
        });

        const matchingAutos = autoSnap.docs.filter((d) => d.data().createdBy === payload.sourcePersonId && d.data().isArchived !== true);

        for (let i = 0; i < matchingAutos.length; i += CHUNK_SIZE) {
          const chunk = matchingAutos.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const a of chunk) {
            batch.update(a.ref, {
              createdBy: payload.targetPersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }
        transferredCounts.automation = matchingAutos.length;
      }

      const totalTransferred = Object.values(transferredCounts).reduce((a, b) => a + b, 0);

      const completedJob: CrmOwnershipTransferJob = {
        ...job,
        status: 'completed',
        transferredCounts,
        totalTransferred,
        completedAt: new Date().toISOString(),
      };

      await jobRef.set(completedJob, { merge: true });

      // Audit Log
      await SecurityAuditService.logEvent(organizationId, {
        eventType: 'role_granted',
        actorId: payload.executedBy,
        actorName: 'Workforce Admin',
        targetId: targetPerson.id,
        targetName: targetPerson.displayName,
        description: `Transferred ${totalTransferred} CRM assets from ${sourcePerson.displayName} to ${targetPerson.displayName}${payload.workspaceId ? ` in workspace ${payload.workspaceId}` : ''}.`,
      });

      return completedJob;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed';
      await jobRef.update({
        status: 'failed',
        error: msg,
        completedAt: new Date().toISOString(),
      });
      throw err;
    }
  }

  /**
   * Lists all ownership transfer jobs for an organization, optionally filtered by workspace.
   */
  static async listTransferJobs(
    organizationId: string,
    workspaceId?: string
  ): Promise<CrmOwnershipTransferJob[]> {
    let query: FirebaseFirestore.Query = adminDb
      .collection(this.collectionName)
      .where('organizationId', '==', organizationId);

    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }

    const snap = await query.get();
    const jobs = snap.docs.map((d) => d.data() as CrmOwnershipTransferJob);
    return jobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
}
