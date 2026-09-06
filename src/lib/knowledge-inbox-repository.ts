import { adminDb } from '@/lib/firebase-admin';
import {
  KNOWLEDGE_INBOX_COLLECTION,
  KNOWLEDGE_INSIGHTS_COLLECTION,
  type KnowledgeInboxItem,
  type KnowledgeInsight,
  type InboxFilterOptions,
  type InsightFilterOptions,
} from './quick-notes-types';

/**
 * Knowledge Inbox & Insights Repository (Company Brain Phase 7).
 *
 * Server-only data access layer for human-in-the-loop review queue and executive insights.
 * Enforces strict multi-tenant boundary isolation by workspaceId.
 */

const MAX_BATCH_SIZE = 450;

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = stripUndefined(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

export class KnowledgeInboxRepository {
  private static get inboxCollection() {
    return adminDb.collection(KNOWLEDGE_INBOX_COLLECTION);
  }

  private static get insightsCollection() {
    return adminDb.collection(KNOWLEDGE_INSIGHTS_COLLECTION);
  }

  /* --------------------------------------------------------------------------
   * KNOWLEDGE INBOX METHODS
   * -------------------------------------------------------------------------- */

  /**
   * Creates an item in the Knowledge Inbox queue.
   */
  static async createInboxItem(
    item: Omit<KnowledgeInboxItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<KnowledgeInboxItem> {
    const docRef = item.id ? this.inboxCollection.doc(item.id) : this.inboxCollection.doc();
    const now = new Date().toISOString();

    const record: KnowledgeInboxItem = {
      ...item,
      id: docRef.id,
      evidence: item.evidence || [],
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(stripUndefined(record as unknown as Record<string, unknown>));
    return record;
  }

  /**
   * Batched creation of multiple inbox suggestions with deduplication.
   */
  static async batchCreateInboxItems(
    workspaceIdOrItems: string | Array<Omit<KnowledgeInboxItem, 'id' | 'createdAt' | 'updatedAt'>>,
    maybeItems?: Array<Omit<KnowledgeInboxItem, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<number> {
    const items = Array.isArray(workspaceIdOrItems)
      ? workspaceIdOrItems
      : (maybeItems || []);
    if (!items || items.length === 0) return 0;

    const now = new Date().toISOString();
    let written = 0;

    for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
      const chunk = items.slice(i, i + MAX_BATCH_SIZE);
      const batch = adminDb.batch();

      for (const rawItem of chunk) {
        const docRef = this.inboxCollection.doc();
        const record: KnowledgeInboxItem = {
          ...rawItem,
          id: docRef.id,
          evidence: rawItem.evidence || [],
          createdAt: now,
          updatedAt: now,
        };
        batch.set(docRef, stripUndefined(record as unknown as Record<string, unknown>));
      }

      await batch.commit();
      written += chunk.length;
    }

    return written;
  }

  /**
   * Fetches inbox items scoped to a workspace.
   */
  static async getWorkspaceInbox(
    workspaceId: string,
    options?: InboxFilterOptions
  ): Promise<KnowledgeInboxItem[]> {
    let query: FirebaseFirestore.Query = this.inboxCollection.where('workspaceId', '==', workspaceId);

    if (options?.status && options.status !== 'all') {
      query = query.where('status', '==', options.status);
    }
    if (options?.type && options.type !== 'all') {
      query = query.where('type', '==', options.type);
    }

    const limit = options?.limit || 150;
    const snap = await query.limit(limit).get();

    return snap.docs.map((doc) => doc.data() as KnowledgeInboxItem);
  }

  /**
   * Gets an inbox item by ID with multi-tenant verification.
   */
  static async getInboxItem(workspaceId: string, itemId: string): Promise<KnowledgeInboxItem | null> {
    const docRef = this.inboxCollection.doc(itemId);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const data = snap.data() as KnowledgeInboxItem;
    if (data.workspaceId !== workspaceId) {
      throw new Error(`Cross-tenant access forbidden: Inbox item ${itemId} does not belong to workspace ${workspaceId}`);
    }
    return data;
  }

  /**
   * Updates an inbox item's review status and patch notes.
   */
  static async updateInboxItemStatus(
    workspaceId: string,
    itemId: string,
    update: Partial<Pick<KnowledgeInboxItem, 'status' | 'reviewedBy' | 'reviewNotes'>>
  ): Promise<KnowledgeInboxItem> {
    const existing = await this.getInboxItem(workspaceId, itemId);
    if (!existing) {
      throw new Error(`Knowledge inbox item ${itemId} not found`);
    }

    const now = new Date().toISOString();
    const patch: Partial<KnowledgeInboxItem> = {
      ...update,
      reviewedAt: now,
      updatedAt: now,
    };

    await this.inboxCollection.doc(itemId).update(stripUndefined(patch as Record<string, unknown>));
    return { ...existing, ...patch };
  }

  /**
   * Bulk updates statuses of inbox items (e.g. Accept All / Dismiss All).
   */
  static async bulkUpdateStatus(
    workspaceId: string,
    itemIds: string[],
    status: KnowledgeInboxItem['status'],
    reviewedBy: string
  ): Promise<number> {
    if (!itemIds || itemIds.length === 0) return 0;

    const now = new Date().toISOString();
    let count = 0;

    for (let i = 0; i < itemIds.length; i += MAX_BATCH_SIZE) {
      const chunk = itemIds.slice(i, i + MAX_BATCH_SIZE);
      const batch = adminDb.batch();

      for (const id of chunk) {
        const docRef = this.inboxCollection.doc(id);
        batch.update(docRef, {
          status,
          reviewedBy,
          reviewedAt: now,
          updatedAt: now,
        });
      }

      await batch.commit();
      count += chunk.length;
    }

    return count;
  }

  /* --------------------------------------------------------------------------
   * KNOWLEDGE INSIGHTS METHODS
   * -------------------------------------------------------------------------- */

  /**
   * Creates an authoritative insight entity in Insight Center.
   */
  static async createInsight(
    insight: Omit<KnowledgeInsight, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<KnowledgeInsight> {
    const docRef = insight.id ? this.insightsCollection.doc(insight.id) : this.insightsCollection.doc();
    const now = new Date().toISOString();

    const record: KnowledgeInsight = {
      ...insight,
      id: docRef.id,
      evidenceSources: insight.evidenceSources || [],
      suggestedActions: insight.suggestedActions || [],
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(stripUndefined(record as unknown as Record<string, unknown>));
    return record;
  }

  /**
   * Batched creation of multiple insights.
   */
  static async batchCreateInsights(
    workspaceIdOrInsights: string | Array<Omit<KnowledgeInsight, 'id' | 'createdAt' | 'updatedAt'>>,
    maybeInsights?: Array<Omit<KnowledgeInsight, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<number> {
    const insights = Array.isArray(workspaceIdOrInsights)
      ? workspaceIdOrInsights
      : (maybeInsights || []);
    if (!insights || insights.length === 0) return 0;

    const now = new Date().toISOString();
    let written = 0;

    for (let i = 0; i < insights.length; i += MAX_BATCH_SIZE) {
      const chunk = insights.slice(i, i + MAX_BATCH_SIZE);
      const batch = adminDb.batch();

      for (const raw of chunk) {
        const docRef = this.insightsCollection.doc();
        const record: KnowledgeInsight = {
          ...raw,
          id: docRef.id,
          evidenceSources: raw.evidenceSources || [],
          suggestedActions: raw.suggestedActions || [],
          createdAt: now,
          updatedAt: now,
        };
        batch.set(docRef, stripUndefined(record as unknown as Record<string, unknown>));
      }

      await batch.commit();
      written += chunk.length;
    }

    return written;
  }

  /**
   * Fetches all insights for a workspace.
   */
  static async getWorkspaceInsights(
    workspaceId: string,
    options?: InsightFilterOptions
  ): Promise<KnowledgeInsight[]> {
    let query: FirebaseFirestore.Query = this.insightsCollection.where('workspaceId', '==', workspaceId);

    if (options?.status && options.status !== 'all') {
      query = query.where('status', '==', options.status);
    }
    if (options?.severity && options.severity !== 'all') {
      query = query.where('severity', '==', options.severity);
    }
    if (options?.type && options.type !== 'all') {
      query = query.where('type', '==', options.type);
    }

    const limit = options?.limit || 100;
    const snap = await query.limit(limit).get();

    return snap.docs.map((doc) => doc.data() as KnowledgeInsight);
  }

  /**
   * Updates an insight's status (e.g. promoted to idea or resolved).
   */
  static async updateInsight(
    workspaceId: string,
    insightId: string,
    update: Partial<KnowledgeInsight>
  ): Promise<KnowledgeInsight> {
    const docRef = this.insightsCollection.doc(insightId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error(`Insight ${insightId} not found`);
    }

    const existing = snap.data() as KnowledgeInsight;
    if (existing.workspaceId !== workspaceId) {
      throw new Error(`Cross-tenant access forbidden: Insight ${insightId} does not belong to workspace ${workspaceId}`);
    }

    const patch = {
      ...update,
      updatedAt: new Date().toISOString(),
    };

    await docRef.update(stripUndefined(patch as Record<string, unknown>));
    return { ...existing, ...patch };
  }

  /**
   * Deletes an insight entity.
   */
  static async deleteInsight(workspaceId: string, insightId: string): Promise<boolean> {
    const docRef = this.insightsCollection.doc(insightId);
    const snap = await docRef.get();
    if (!snap.exists) return false;

    const data = snap.data() as KnowledgeInsight;
    if (data.workspaceId !== workspaceId) {
      throw new Error(`Cross-tenant access forbidden: Insight ${insightId} does not belong to workspace ${workspaceId}`);
    }

    await docRef.delete();
    return true;
  }
}
