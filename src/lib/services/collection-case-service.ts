/**
 * SmartSapp Finance 2.0 - Collection Case Service
 * Manages debt collection cases, multi-invoice rollups, and stage progressions.
 */

import { 
  CollectionCase, 
  CollectionStage, 
  CollectionPriority, 
  Invoice, 
  FinancialAccount 
} from '../types';
import { CollectionCaseSequenceService } from './collection-case-sequence-service';
import { CollectionActivityService } from './collection-activity-service';
import { AgingService } from './aging-service';

export class CollectionCaseService {
  /**
   * Retrieves or creates a single canonical open collection case for an entity.
   * Aggregates all outstanding overdue invoices into the case rollup.
   */
  static async getOrCreateCaseForEntity(
    entityId: string,
    workspaceId: string,
    userId: string,
    userName: string
  ): Promise<CollectionCase> {
    const { adminDb } = await import('../firebase-admin');
    // 1. Check for existing open case
    const existingSnap = await adminDb
      .collection('collection_cases')
      .where('entityId', '==', entityId)
      .where('workspaceIds', 'array-contains', workspaceId)
      .where('stage', '!=', 'resolved')
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      return { id: doc.id, ...(doc.data() as Omit<CollectionCase, 'id'>) };
    }

    // 2. Fetch Entity Account
    const accSnap = await adminDb
      .collection('financial_accounts')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    const account = !accSnap.empty 
      ? { id: accSnap.docs[0].id, ...(accSnap.docs[0].data() as Omit<FinancialAccount, 'id'>) }
      : null;

    // 3. Fetch all open invoices
    const invSnap = await adminDb
      .collection('invoices')
      .where('entityId', '==', entityId)
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    let totalDebt = 0;
    let oldestDays = 0;
    const invoiceIds: string[] = [];
    const invoiceNumbers: string[] = [];
    const now = new Date();

    for (const doc of invSnap.docs) {
      const inv = { id: doc.id, ...(doc.data() as Omit<Invoice, 'id'>) };
      if (
        inv.status === 'void' ||
        inv.lifecycleStatus === 'void' ||
        inv.status === 'draft' ||
        inv.status === 'paid' ||
        (inv.balanceDue !== undefined && inv.balanceDue <= 0)
      ) {
        continue;
      }

      const aging = AgingService.calculateInvoiceAging(inv, now);
      if (aging.balanceDue > 0) {
        totalDebt = Math.round((totalDebt + aging.balanceDue) * 100) / 100;
        invoiceIds.push(inv.id);
        invoiceNumbers.push(inv.invoiceNumber);
        if (aging.daysOverdue > oldestDays) {
          oldestDays = aging.daysOverdue;
        }
      }
    }

    // Determine initial stage and priority
    let stage: CollectionStage = 'reminder';
    let priority: CollectionPriority = 'low';

    if (oldestDays > 90) {
      stage = 'escalation';
      priority = 'critical';
    } else if (oldestDays > 60) {
      stage = 'active_collection';
      priority = 'high';
    } else if (oldestDays > 30) {
      stage = 'follow_up';
      priority = 'medium';
    }

    const timestamp = new Date().toISOString();
    const caseNumber = await CollectionCaseSequenceService.getNextNumber(workspaceId, 'CAS');

    const caseData: Omit<CollectionCase, 'id'> = {
      organizationId: account?.organizationId || 'default',
      workspaceIds: [workspaceId],
      caseNumber,
      accountId: account?.id || '',
      entityId,
      entityName: account?.accountName || 'Organization',
      totalDebt: totalDebt || Number(account?.currentBalance || 0),
      currency: account?.currency || 'GHS',
      oldestInvoiceDays: oldestDays,
      invoiceIds,
      invoiceNumbers,
      stage,
      priority,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await adminDb.collection('collection_cases').add(caseData);
    const collectionCase: CollectionCase = { id: docRef.id, ...caseData };

    // Log initialization activity
    await CollectionActivityService.logActivity({
      workspaceId,
      organizationId: caseData.organizationId,
      caseId: docRef.id,
      entityId,
      type: 'stage_change',
      summary: `Collection case ${caseNumber} opened in stage '${stage}' with total debt GHS ${totalDebt}`,
      userId,
      userName,
    });

    return collectionCase;
  }

  /**
   * Advances or updates the stage of a collection case.
   */
  static async updateCaseStage(
    caseId: string,
    stage: CollectionStage,
    userId: string,
    userName: string,
    notes?: string
  ): Promise<CollectionCase> {
    const { adminDb } = await import('../firebase-admin');
    const docRef = adminDb.collection('collection_cases').doc(caseId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error('Collection case not found');
    }

    const existing = { id: snap.id, ...(snap.data() as Omit<CollectionCase, 'id'>) };
    const timestamp = new Date().toISOString();

    const updates: Partial<CollectionCase> = {
      stage,
      updatedAt: timestamp,
      resolvedAt: stage === 'resolved' ? timestamp : undefined,
    };

    // Auto-update priority if escalated or resolved
    if (stage === 'escalation' || stage === 'final_notice' || stage === 'legal_external') {
      updates.priority = 'critical';
    } else if (stage === 'resolved') {
      updates.priority = 'low';
    }

    await docRef.update(updates);

    // Sync financial account collection status
    if (existing.accountId) {
      let accStatus: FinancialAccount['collectionStatus'] = 'current';
      if (stage === 'reminder') accStatus = 'reminder';
      else if (stage === 'follow_up') accStatus = 'follow_up';
      else if (stage === 'active_collection') accStatus = 'collection';
      else if (stage === 'escalation' || stage === 'final_notice') accStatus = 'escalated';

      await adminDb.collection('financial_accounts').doc(existing.accountId).update({
        collectionStatus: accStatus,
        updatedAt: timestamp,
      });
    }

    await CollectionActivityService.logActivity({
      workspaceId: existing.workspaceIds[0],
      organizationId: existing.organizationId,
      caseId,
      entityId: existing.entityId,
      type: 'stage_change',
      summary: `Stage changed from '${existing.stage}' to '${stage}'`,
      details: notes,
      userId,
      userName,
    });

    return { ...existing, ...updates };
  }

  /**
   * Assigns a collection officer to the case.
   */
  static async assignCase(
    caseId: string,
    assignedToUserId: string,
    assignedToName: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const { adminDb } = await import('../firebase-admin');
    const docRef = adminDb.collection('collection_cases').doc(caseId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error('Collection case not found');

    const existing = snap.data() as CollectionCase;
    const timestamp = new Date().toISOString();

    await docRef.update({
      assignedToUserId,
      assignedToName,
      updatedAt: timestamp,
    });

    await CollectionActivityService.logActivity({
      workspaceId: existing.workspaceIds[0],
      organizationId: existing.organizationId,
      caseId,
      entityId: existing.entityId,
      type: 'note',
      summary: `Assigned collection case to ${assignedToName}`,
      userId,
      userName,
    });
  }
}
