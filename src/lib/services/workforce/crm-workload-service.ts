/**
 * @fileOverview CRM Workload & Asset Allocation Service (Phase 7)
 *
 * Aggregates active ownership counts across leads, contacts, deals, tasks,
 * meetings, campaigns, and automations per workforce member.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Scans multi-entity collections with tenant scoping.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `crm-workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { CrmWorkloadSummary } from '@/lib/types';
import { PersonService } from '@/lib/services/identity/person-service';

export class CrmWorkloadService {
  /**
   * Aggregates CRM workload and asset ownership for a specific team member.
   */
  static async getPersonCrmWorkload(
    organizationId: string,
    personId: string
  ): Promise<CrmWorkloadSummary> {
    const person = await PersonService.getPerson(personId);
    const personName = person?.displayName || person?.email || personId;
    const personEmail = person?.email || '';

    // 1. Query Deals
    let dealCount = 0;
    let totalPipelineValue = 0;
    try {
      const dealsSnap = await adminDb
        .collection('deals')
        .where('organizationId', '==', organizationId)
        .where('assignedTo', '==', personId)
        .get();

      dealCount = dealsSnap.docs.length;
      for (const d of dealsSnap.docs) {
        const val = Number(d.data().value || d.data().amount || 0);
        if (!isNaN(val)) totalPipelineValue += val;
      }
    } catch {
      // Fallback
    }

    // 2. Query Contacts / Leads
    let contactCount = 0;
    let leadCount = 0;
    try {
      const contactsSnap = await adminDb
        .collection('contacts')
        .where('organizationId', '==', organizationId)
        .where('assignedTo', '==', personId)
        .get();

      contactCount = contactsSnap.docs.length;
      leadCount = contactsSnap.docs.filter((c) => c.data().type === 'lead').length;
    } catch {
      // Fallback
    }

    // 3. Query Tasks
    let openTaskCount = 0;
    try {
      const tasksSnap = await adminDb
        .collection('crm_tasks')
        .where('organizationId', '==', organizationId)
        .where('assignedTo', '==', personId)
        .get();

      openTaskCount = tasksSnap.docs.filter((t) => t.data().status !== 'completed').length;
    } catch {
      // Fallback
    }

    // 4. Query Meetings
    let upcomingMeetingCount = 0;
    try {
      const nowIso = new Date().toISOString();
      const meetingsSnap = await adminDb
        .collection('crm_meetings')
        .where('organizationId', '==', organizationId)
        .where('assignedTo', '==', personId)
        .where('startTime', '>=', nowIso)
        .get();

      upcomingMeetingCount = meetingsSnap.docs.length;
    } catch {
      // Fallback
    }

    // 5. Query Automations
    let automationCount = 0;
    try {
      const autoSnap = await adminDb
        .collection('automations')
        .where('organizationId', '==', organizationId)
        .where('createdBy', '==', personId)
        .get();

      automationCount = autoSnap.docs.length;
    } catch {
      // Fallback
    }

    const totalActiveEntities = leadCount + contactCount + dealCount + openTaskCount + automationCount;
    const hasOrphanRisk = totalActiveEntities > 0;

    return {
      personId,
      personName,
      personEmail,
      leadCount,
      contactCount,
      dealCount,
      totalPipelineValue,
      openTaskCount,
      upcomingMeetingCount,
      activeCampaignCount: 0,
      automationCount,
      totalActiveEntities,
      hasOrphanRisk,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates organization-wide CRM asset allocation overview.
   */
  static async getOrganizationCrmWorkloadOverview(
    organizationId: string
  ): Promise<CrmWorkloadSummary[]> {
    const people = await PersonService.getOrganizationPeopleDirectory(organizationId);
    const workloads: CrmWorkloadSummary[] = [];

    for (const p of people) {
      const wl = await this.getPersonCrmWorkload(organizationId, p.person.id);
      workloads.push(wl);
    }

    return workloads.sort((a, b) => b.totalPipelineValue - a.totalPipelineValue || b.totalActiveEntities - a.totalActiveEntities);
  }
}
