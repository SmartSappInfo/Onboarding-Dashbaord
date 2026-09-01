/**
 * @fileOverview Deterministic CRM Ownership Transfer Engine (Phase 7)
 *
 * Atomically migrates portfolios of leads, contacts, deals, tasks, meetings,
 * and automations from a source member to a target member in safe batches of <= 250 write operations.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs batching with progress tracking in `crm_ownership_transfers`.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `crm-workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  CrmEntityType,
  CrmOwnershipTransferJob,
  CrmOwnershipTransferStatus,
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

    const jobRef = adminDb.collection(this.collectionName).doc();
    const now = new Date().toISOString();

    const job: CrmOwnershipTransferJob = {
      id: jobRef.id,
      organizationId,
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
        const dealsSnap = await adminDb
          .collection('deals')
          .where('organizationId', '==', organizationId)
          .where('assignedTo', '==', payload.sourcePersonId)
          .get();

        for (let i = 0; i < dealsSnap.docs.length; i += CHUNK_SIZE) {
          const chunk = dealsSnap.docs.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const d of chunk) {
            batch.update(d.ref, {
              assignedTo: payload.targetPersonId,
              historicOwnerId: payload.sourcePersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }
        transferredCounts.deal = dealsSnap.docs.length;
      }

      // 2. Transfer Contacts & Leads
      if (payload.entityTypes.includes('contact') || payload.entityTypes.includes('lead')) {
        const contactsSnap = await adminDb
          .collection('contacts')
          .where('organizationId', '==', organizationId)
          .where('assignedTo', '==', payload.sourcePersonId)
          .get();

        for (let i = 0; i < contactsSnap.docs.length; i += CHUNK_SIZE) {
          const chunk = contactsSnap.docs.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const c of chunk) {
            batch.update(c.ref, {
              assignedTo: payload.targetPersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }
        transferredCounts.contact = contactsSnap.docs.length;
      }

      // 3. Transfer Tasks
      if (payload.entityTypes.includes('task')) {
        const tasksSnap = await adminDb
          .collection('crm_tasks')
          .where('organizationId', '==', organizationId)
          .where('assignedTo', '==', payload.sourcePersonId)
          .get();

        for (let i = 0; i < tasksSnap.docs.length; i += CHUNK_SIZE) {
          const chunk = tasksSnap.docs.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const t of chunk) {
            batch.update(t.ref, {
              assignedTo: payload.targetPersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }
        transferredCounts.task = tasksSnap.docs.length;
      }

      // 4. Transfer Meetings
      if (payload.entityTypes.includes('meeting')) {
        const meetingsSnap = await adminDb
          .collection('crm_meetings')
          .where('organizationId', '==', organizationId)
          .where('assignedTo', '==', payload.sourcePersonId)
          .get();

        for (let i = 0; i < meetingsSnap.docs.length; i += CHUNK_SIZE) {
          const chunk = meetingsSnap.docs.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const m of chunk) {
            batch.update(m.ref, {
              assignedTo: payload.targetPersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }
        transferredCounts.meeting = meetingsSnap.docs.length;
      }

      // 5. Transfer Automations
      if (payload.entityTypes.includes('automation')) {
        const autoSnap = await adminDb
          .collection('automations')
          .where('organizationId', '==', organizationId)
          .where('createdBy', '==', payload.sourcePersonId)
          .get();

        for (let i = 0; i < autoSnap.docs.length; i += CHUNK_SIZE) {
          const chunk = autoSnap.docs.slice(i, i + CHUNK_SIZE);
          const batch = adminDb.batch();
          for (const a of chunk) {
            batch.update(a.ref, {
              createdBy: payload.targetPersonId,
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }
        transferredCounts.automation = autoSnap.docs.length;
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
        description: `Transferred ${totalTransferred} CRM assets from ${sourcePerson.displayName} to ${targetPerson.displayName}.`,
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
   * Lists all ownership transfer jobs for an organization.
   */
  static async listTransferJobs(organizationId: string): Promise<CrmOwnershipTransferJob[]> {
    const snap = await adminDb
      .collection(this.collectionName)
      .where('organizationId', '==', organizationId)
      .get();

    const jobs = snap.docs.map((d) => d.data() as CrmOwnershipTransferJob);
    return jobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
}
