import { adminDb } from '@/lib/firebase-admin';
import {
  IDEAS_COLLECTION,
  type Idea,
  type IdeaCanvasLayout,
  type IdeaFilterOptions,
} from './quick-notes-types';
import { calculateIceScore } from './quick-notes-domain';

/**
 * Idea Repository (Company Brain Phase 6).
 *
 * Server-only data access layer for Idea Intelligence & Decision Studio.
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

export class IdeaRepository {
  private static get collection() {
    return adminDb.collection(IDEAS_COLLECTION);
  }

  /**
   * Creates and persists an Idea entity.
   */
  static async createIdea(
    idea: Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'iceScore'> & {
      id?: string;
      iceScore?: number;
    }
  ): Promise<Idea> {
    const docRef = idea.id ? this.collection.doc(idea.id) : this.collection.doc();
    const now = new Date().toISOString();

    const computedIce =
      idea.iceScore !== undefined
        ? idea.iceScore
        : calculateIceScore(idea.impact, idea.effort, idea.confidence);

    const record: Idea = {
      ...idea,
      id: docRef.id,
      iceScore: computedIce,
      assumptions: idea.assumptions || [],
      hypotheses: idea.hypotheses || [],
      experiments: idea.experiments || [],
      decisions: idea.decisions || [],
      evidenceIds: idea.evidenceIds || [],
      tags: idea.tags || [],
      relatedIdeaIds: idea.relatedIdeaIds || [],
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(stripUndefined(record as unknown as Record<string, unknown>));
    return record;
  }

  /**
   * Reads a single idea safely, verifying workspace boundaries.
   */
  static async getIdea(workspaceId: string, ideaId: string): Promise<Idea | null> {
    const docRef = this.collection.doc(ideaId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return null;
    }

    const data = snap.data() as Idea;
    if (data.workspaceId !== workspaceId) {
      throw new Error('Forbidden: Cross-tenant idea retrieval blocked.');
    }

    return data;
  }

  /**
   * Fetches an idea by ID directly.
   */
  static async getById(ideaId: string): Promise<Idea | null> {
    const docRef = this.collection.doc(ideaId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return snap.data() as Idea;
  }

  /**
   * Finds an idea associated with a specific QuickNote ID.
   */
  static async getIdeaByKnowledgeObjectId(
    workspaceId: string,
    knowledgeObjectId: string
  ): Promise<Idea | null> {
    const snap = await this.collection
      .where('workspaceId', '==', workspaceId)
      .where('knowledgeObjectId', '==', knowledgeObjectId)
      .limit(1)
      .get();

    if (snap.empty) {
      return null;
    }

    return snap.docs[0].data() as Idea;
  }

  /**
   * Lists all ideas for a workspace with flexible filtering and sorting.
   */
  static async listIdeas(
    workspaceId: string,
    options: IdeaFilterOptions = {}
  ): Promise<Idea[]> {
    let query: FirebaseFirestore.Query = this.collection.where('workspaceId', '==', workspaceId);

    if (options.lifecycleStage && options.lifecycleStage !== 'all') {
      query = query.where('lifecycleStage', '==', options.lifecycleStage);
    }

    if (options.validationStatus && options.validationStatus !== 'all') {
      query = query.where('validationStatus', '==', options.validationStatus);
    }

    if (options.priority && options.priority !== 'all') {
      query = query.where('priority', '==', options.priority);
    }

    if (options.createdBy) {
      query = query.where('createdBy', '==', options.createdBy);
    }

    // Default sorting by updatedAt descending
    query = query.orderBy('updatedAt', 'desc').limit(250);

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as Idea);
  }

  /**
   * Convenience method to list ideas by workspace.
   */
  static async listByWorkspace(workspaceId: string, limit = 250): Promise<Idea[]> {
    return this.listIdeas(workspaceId);
  }

  /**
   * Updates an Idea document, recalculating ICE score if parameters changed.
   */
  static async updateIdea(
    workspaceId: string,
    ideaId: string,
    updates: Partial<Omit<Idea, 'id' | 'workspaceId' | 'createdAt'>>
  ): Promise<Idea> {
    const existing = await this.getIdea(workspaceId, ideaId);
    if (!existing) {
      throw new Error(`Idea not found: ${ideaId}`);
    }

    const now = new Date().toISOString();

    const newImpact = updates.impact !== undefined ? updates.impact : existing.impact;
    const newEffort = updates.effort !== undefined ? updates.effort : existing.effort;
    const newConfidence = updates.confidence !== undefined ? updates.confidence : existing.confidence;

    const computedIce = calculateIceScore(newImpact, newEffort, newConfidence);

    const merged: Idea = {
      ...existing,
      ...updates,
      impact: newImpact,
      effort: newEffort,
      confidence: newConfidence,
      iceScore: computedIce,
      updatedAt: now,
    };

    await this.collection.doc(ideaId).set(stripUndefined(merged as unknown as Record<string, unknown>));
    return merged;
  }

  /**
   * Deletes an Idea document safely with workspace verification.
   */
  static async deleteIdea(workspaceId: string, ideaId: string): Promise<void> {
    const existing = await this.getIdea(workspaceId, ideaId);
    if (!existing) {
      return;
    }

    await this.collection.doc(ideaId).delete();
  }

  /**
   * Saves the visual canvas layout for an Idea.
   */
  static async saveCanvasLayout(
    workspaceId: string,
    ideaId: string,
    layout: IdeaCanvasLayout
  ): Promise<void> {
    const existing = await this.getIdea(workspaceId, ideaId);
    if (!existing) {
      throw new Error(`Idea not found: ${ideaId}`);
    }

    await this.collection.doc(ideaId).update({
      canvasLayout: stripUndefined(layout as unknown as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Batch creates ideas up to Firestore transaction limits (<= 450 items).
   */
  static async batchCreateIdeas(workspaceId: string, ideas: Idea[]): Promise<number> {
    if (!ideas.length) return 0;

    let saved = 0;
    const chunks: Idea[][] = [];
    for (let i = 0; i < ideas.length; i += MAX_BATCH_SIZE) {
      chunks.push(ideas.slice(i, i + MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
      const batch = adminDb.batch();
      for (const item of chunk) {
        if (item.workspaceId !== workspaceId) continue;
        const ref = this.collection.doc(item.id);
        batch.set(ref, stripUndefined(item as unknown as Record<string, unknown>));
        saved++;
      }
      await batch.commit();
    }

    return saved;
  }
}
